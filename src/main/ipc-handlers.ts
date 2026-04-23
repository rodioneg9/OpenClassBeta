import { ipcMain, shell } from 'electron'
import { startOAuthFlow, refreshAccessToken } from './auth'
import { saveTokens, getTokens, clearTokens } from './store'
import {
  addSubmissionAttachments,
  getCourses,
  getCourseWork,
  getMySubmission,
  getSubmissions,
  getAnnouncements,
  getStudents,
  removeSubmissionAttachments,
  submitAssignment,
  unsubmitAssignment,
  uploadDriveFilesAsAttachments,
  type SubmissionAttachment,
  type UploadableFile
} from './classroom-api'
import { loadPlugins } from './plugin-loader'
import { extensionManager } from './extensions'
import type { ClassroomContext, ExtensionSupportType } from './extensions'
import { askStudyMaterialAI, type StudyMaterialChunk } from './study-material-ai'

/**
 * Retrieves a valid access token, refreshing it if it is expired or about to expire.
 * Throws if no tokens are stored.
 */
async function getValidAccessToken(): Promise<string> {
  const tokens = getTokens()
  if (!tokens) {
    throw new Error('Not authenticated')
  }

  const EXPIRY_BUFFER_MS = 1 * 60 * 1000 // refresh 1 minute before expiry
  const isExpired = tokens.expiry_date != null && Date.now() >= tokens.expiry_date - EXPIRY_BUFFER_MS

  if (isExpired && tokens.refresh_token) {
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    // Preserve the refresh token if the new response doesn't include one
    if (!refreshed.refresh_token) {
      refreshed.refresh_token = tokens.refresh_token
    }
    saveTokens(refreshed)
    return refreshed.access_token
  }

  return tokens.access_token
}

export function registerIpcHandlers(): void {
  // ── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:login', async () => {
    const tokens = await startOAuthFlow()
    saveTokens(tokens)
    return { success: true }
  })

  ipcMain.handle('auth:logout', () => {
    clearTokens()
    return { success: true }
  })

  ipcMain.handle('auth:get-status', () => {
    const tokens = getTokens()
    return { isAuthenticated: tokens !== null }
  })

  ipcMain.handle('auth:get-access-token', async () => {
    const accessToken = await getValidAccessToken()
    return { accessToken }
  })

  ipcMain.handle('auth:refresh', async () => {
    const tokens = getTokens()
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available')
    }
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    if (!refreshed.refresh_token) {
      refreshed.refresh_token = tokens.refresh_token
    }
    saveTokens(refreshed)
    return { success: true }
  })

  // ── Classroom ─────────────────────────────────────────────────────────────
  ipcMain.handle('classroom:get-courses', async () => {
    const token = await getValidAccessToken()
    return getCourses(token)
  })

  ipcMain.handle('classroom:get-coursework', async (_event, courseId: string) => {
    const token = await getValidAccessToken()
    return getCourseWork(courseId, token)
  })

  ipcMain.handle(
    'classroom:get-submissions',
    async (_event, courseId: string, courseWorkId: string) => {
      const token = await getValidAccessToken()
      return getSubmissions(courseId, courseWorkId, token)
    }
  )

  ipcMain.handle('classroom:get-announcements', async (_event, courseId: string) => {
    const token = await getValidAccessToken()
    return getAnnouncements(courseId, token)
  })

  ipcMain.handle('classroom:get-students', async (_event, courseId: string) => {
    const token = await getValidAccessToken()
    return getStudents(courseId, token)
  })

  ipcMain.handle(
    'classroom:submit-assignment',
    async (_event, courseId: string, courseWorkId: string, submissionId: string) => {
      const token = await getValidAccessToken()
      return submitAssignment(courseId, courseWorkId, submissionId, token)
    }
  )

  ipcMain.handle(
    'classroom:unsubmit-assignment',
    async (_event, courseId: string, courseWorkId: string, submissionId: string) => {
      const token = await getValidAccessToken()
      return unsubmitAssignment(courseId, courseWorkId, submissionId, token)
    }
  )

  ipcMain.handle('classroom:get-my-submission', async (_event, courseId: string, courseWorkId: string) => {
    const token = await getValidAccessToken()
    return getMySubmission(courseId, courseWorkId, token)
  })

  ipcMain.handle(
    'classroom:add-submission-attachments',
    async (
      _event,
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachments: SubmissionAttachment[]
    ) => {
      const token = await getValidAccessToken()
      return addSubmissionAttachments(courseId, courseWorkId, submissionId, attachments, token)
    }
  )

  ipcMain.handle(
    'classroom:remove-submission-attachments',
    async (
      _event,
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachmentIds: string[]
    ) => {
      const token = await getValidAccessToken()
      return removeSubmissionAttachments(courseId, courseWorkId, submissionId, attachmentIds, token)
    }
  )

  ipcMain.handle(
    'classroom:upload-files-as-attachments',
    async (_event, files: UploadableFile[]) => {
      const token = await getValidAccessToken()
      return uploadDriveFilesAsAttachments(files, token)
    }
  )

  // ── Shell ─────────────────────────────────────────────────────────────────
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid URL format. Please provide a valid HTTP or HTTPS URL.')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Unsupported URL protocol '${parsed.protocol}'. Only HTTP and HTTPS URLs are allowed.`
      )
    }

    await shell.openExternal(parsed.toString())
    return { success: true }
  })

  // ── Plugins ───────────────────────────────────────────────────────────────
  ipcMain.handle('plugins:load', async () => {
    const registry = await loadPlugins()
    // Return serialisable plugin metadata only
    return registry.plugins.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      panels: p.panels,
      coursePageExtensions: p.coursePageExtensions,
      actions: p.actions.map(({ id, label }) => ({ id, label })) // omit non-serialisable handler
    }))
  })

  // ── Extensions ────────────────────────────────────────────────────────────
  ipcMain.handle('extensions:get-for', (_event, type: ExtensionSupportType) => {
    return extensionManager.getExtensionsFor(type)
  })

  ipcMain.handle(
    'extensions:run',
    async (_event, extensionId: string, context: ClassroomContext) => {
      return extensionManager.runExtension(extensionId, context)
    }
  )

  ipcMain.handle(
    'study-material:ask',
    async (_event, question: string, chunks: StudyMaterialChunk[]) => {
      return askStudyMaterialAI(question, chunks)
    }
  )
}
