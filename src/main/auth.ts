import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import { URL } from 'url'

export const GOOGLE_CLIENT_ID = 'ЗАМЕНИТЕ НА ВАШ'
const GOOGLE_CLIENT_SECRET = 'ЗАМЕНИТЕ НА ВАШ'
const REDIRECT_PORT = 42813
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile'
].join(' ')

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  id_token?: string
  expiry_date?: number
}

export function generateCodeVerifier(): string {
  return randomBytes(64).toString('base64url')
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash('sha256').update(verifier).digest()
  return Buffer.from(hash).toString('base64url')
}

export async function startOAuthFlow(): Promise<OAuthTokens> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = randomBytes(16).toString('hex')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  // PKCE for desktop apps: send only the challenge here; the verifier is sent later in token exchange.
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      const reqUrl = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
      const code = reqUrl.searchParams.get('code')
      const returnedState = reqUrl.searchParams.get('state')
      const error = reqUrl.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h2>Authentication failed. You may close this window.</h2></body></html>')
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<html><body><h2>Invalid callback. You may close this window.</h2></body></html>')
        server.close()
        reject(new Error('Invalid OAuth callback: missing code or state mismatch'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body><h2>Authentication successful! You may close this window.</h2></body></html>')
      server.close()

      try {
        const tokens = await handleOAuthCallback(code, codeVerifier)
        resolve(tokens)
      } catch (err) {
        reject(err)
      }
    })

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      shell.openExternal(authUrl.toString()).catch(reject)
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start OAuth callback server: ${err.message}`))
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth flow timed out'))
    }, 5 * 60 * 1000)
  })
}

export async function handleOAuthCallback(code: string, codeVerifier: string): Promise<OAuthTokens> {
  if (!codeVerifier) {
    throw new Error('code_verifier is empty!')
  }

  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    const errorBody = await response.json()  // ← json вместо text
    throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(errorBody)}`)
  }

  const tokens = (await response.json()) as OAuthTokens
  tokens.expiry_date = Date.now() + tokens.expires_in * 1000
  return tokens
}
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token'
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Token refresh failed: ${response.status} ${errorBody}`)
  }

  const tokens = (await response.json()) as OAuthTokens
  tokens.expiry_date = Date.now() + tokens.expires_in * 1000
  return tokens
}
