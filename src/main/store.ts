import { safeStorage, app } from 'electron'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { OAuthTokens } from './auth'

const TOKEN_FILE = 'tokens.bin'

function getTokenPath(): string {
  return join(app.getPath('userData'), TOKEN_FILE)
}

export function saveTokens(tokens: OAuthTokens): void {
  const json = JSON.stringify(tokens)
  const tokenPath = getTokenPath()

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    writeFileSync(tokenPath, encrypted)
  } else {
    // Fallback: base64 encode (not secure, but functional on systems without keychain)
    writeFileSync(tokenPath, Buffer.from(json).toString('base64'), 'utf-8')
  }
}

export function getTokens(): OAuthTokens | null {
  const tokenPath = getTokenPath()

  if (!existsSync(tokenPath)) {
    return null
  }

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = readFileSync(tokenPath)
      const json = safeStorage.decryptString(encrypted)
      return JSON.parse(json) as OAuthTokens
    } else {
      const b64 = readFileSync(tokenPath, 'utf-8')
      const json = Buffer.from(b64, 'base64').toString('utf-8')
      return JSON.parse(json) as OAuthTokens
    }
  } catch {
    // If decryption fails, treat as no tokens
    return null
  }
}

export function clearTokens(): void {
  const tokenPath = getTokenPath()
  if (existsSync(tokenPath)) {
    unlinkSync(tokenPath)
  }
}
