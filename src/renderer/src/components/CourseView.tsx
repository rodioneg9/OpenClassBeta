import React, { useEffect, useState } from 'react'
import type {
  Announcement,
  ClassroomContext,
  Course,
  CourseWork,
  ExtensionMetadata,
  ExtensionResult,
  Material,
  Student,
  SubmissionAttachment
} from '../types'
import { useMySubmission } from '../hooks/useClassroom'
import NotebookPanel from './NotebookPanel'
import { getNotebookState } from '../lib/notebook'
import { recordSubmissionAchievement } from '../lib/achievements'
import { assignmentNotificationConfig } from '../config/assignment-notification-config'
import {
  evaluateAssignmentNotifications,
  type AssignmentNotification
} from '../lib/assignment-notifications'

interface CourseViewProps {
  course: Course
}

const CLASSROOM_BASE_URL = 'https://classroom.googleapis.com/v1'
const ASSIGNMENT_ACTION_PANEL_WIDTH = 280
const ASSIGNMENT_NOTEBOOK_MIN_WIDTH = 320
const ASSIGNMENT_WORKSPACE_WITH_NOTEBOOK = `minmax(${ASSIGNMENT_NOTEBOOK_MIN_WIDTH}px, 1.1fr) minmax(0, 1.7fr) ${ASSIGNMENT_ACTION_PANEL_WIDTH}px`
const ASSIGNMENT_WORKSPACE_DEFAULT = `minmax(0, 1fr) ${ASSIGNMENT_ACTION_PANEL_WIDTH}px`
const NOTIFICATION_STYLE_BY_SEVERITY = {
  warning: {
    border: '#f6c7b6',
    background: '#fef4f1',
    color: '#b3261e'
  },
  info: {
    border: '#c2dbff',
    background: '#eef4ff',
    color: '#174ea6'
  }
} as const

function extractGoogleApiErrorMessage(err: unknown): string | null {
  const findMatchingJsonBrace = (value: string, startIndex: number): number => {
    if (startIndex < 0) return -1

    let depth = 0
    let inString = false
    let escaped = false

    for (let i = startIndex; i < value.length; i += 1) {
      const char = value[i]

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') {
        depth += 1
        continue
      }
      if (char === '}') {
        depth -= 1
        if (depth === 0) {
          return i
        }
      }
    }

    return -1
  }

  const tryParseGoogleError = (value: string): string | null => {
    try {
      const parsed = JSON.parse(value) as { error?: { message?: string } }
      return parsed?.error?.message ?? null
    } catch {
      return null
    }
  }

  const candidates: string[] = []
  if (err instanceof Error && err.message) {
    candidates.push(err.message)
  }
  candidates.push(String(err))

  for (const text of candidates) {
    const trimmed = text.trim()
    const direct = tryParseGoogleError(trimmed)
    if (direct) return direct

    const jsonStart = text.indexOf('{"error"')
    const jsonEnd = findMatchingJsonBrace(text, jsonStart)
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const embedded = tryParseGoogleError(text.slice(jsonStart, jsonEnd + 1).trim())
      if (embedded) return embedded
    }
  }

  return null
}

function extractTextAfterFirstColon(text: string): string {
  return text.includes(':') ? text.split(':').slice(1).join(':').trim() : text
}

function parseApiError(err: unknown): string {
  console.error('Submission error:', err)

  const text = String(err)
  const apiMessage = extractGoogleApiErrorMessage(err) || extractTextAfterFirstColon(text)
  const normalizedMessage = apiMessage.toLowerCase()

  if (normalizedMessage.includes('projectpermissiondenied')) {
    return 'This assignment cannot be modified by this application (created by another project).'
  }

  if (
    normalizedMessage.includes('already turned in') ||
    normalizedMessage.includes('already submitted') ||
    normalizedMessage.includes('turned_in')
  ) {
    return 'This assignment is already submitted.'
  }

  if (
    normalizedMessage.includes('insufficient authentication scopes') ||
    normalizedMessage.includes('insufficient permissions') ||
    normalizedMessage.includes('missing required scopes') ||
    normalizedMessage.includes('insufficient scope')
  ) {
    return 'Missing required permissions. Please re-login.'
  }

  return `Submission failed: ${apiMessage || 'An unexpected error occurred.'}`
}

function formatDueDate(cw: CourseWork): string {
  if (!cw.dueDate) return 'No due date'
  const date = new Date(
    cw.dueDate.year,
    cw.dueDate.month - 1,
    cw.dueDate.day,
    cw.dueTime?.hours ?? 0,
    cw.dueTime?.minutes ?? 0
  )
  return `Due ${date.toLocaleDateString()}`
}

async function classroomFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${CLASSROOM_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    throw new Error(`Classroom API error ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

interface MaterialItem {
  url: string
  label: string
}

function getMaterialItems(materials?: Material[]): MaterialItem[] {
  return (
    materials
      ?.map((material) => {
        if (material.link?.url) return { url: material.link.url, label: material.link.title ?? material.link.url }
        if (material.driveFile?.driveFile?.alternateLink) {
          return {
            url: material.driveFile.driveFile.alternateLink,
            label: material.driveFile.driveFile.title ?? material.driveFile.driveFile.alternateLink
          }
        }
        if (material.youtubeVideo?.alternateLink) {
          return { url: material.youtubeVideo.alternateLink, label: material.youtubeVideo.title ?? 'Video' }
        }
        if (material.form?.formUrl) return { url: material.form.formUrl, label: material.form.title ?? 'Form' }
        return null
      })
      .filter((x): x is MaterialItem => x !== null) ?? []
  )
}

function submissionLabel(state?: string): string {
  if (!state) return 'Not submitted'
  if (state === 'CREATED' || state === 'RECLAIMED_BY_STUDENT') return 'Draft'
  if (state === 'TURNED_IN') return 'Submitted'
  if (state === 'RETURNED') return 'Returned'
  return state
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function stringToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function AssignmentCard({
  assignment,
  courseId,
  extensions,
  onRunExtension,
  openingMaterial,
  notifications
}: {
  assignment: CourseWork
  courseId: string
  extensions: ExtensionMetadata[]
  onRunExtension: (extension: ExtensionMetadata, assignment: CourseWork) => Promise<void>
  openingMaterial: (url: string) => void
  notifications: AssignmentNotification[]
}): React.ReactElement {
  const { submission, reload } = useMySubmission(courseId, assignment.id)
  const [openNotebook, setOpenNotebook] = useState(false)
  const [extensionsOpen, setExtensionsOpen] = useState(false)
  const [linksText, setLinksText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [attachNotebookText, setAttachNotebookText] = useState(false)
  const [attachNotebookDrawing, setAttachNotebookDrawing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [unsubmitting, setUnsubmitting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const collectOptionalAttachments = async (): Promise<SubmissionAttachment[]> => {
    const uploadFiles: Array<{ name: string; mimeType: string; contentBase64: string }> = []
    for (const file of selectedFiles) {
      uploadFiles.push({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64: await fileToBase64(file)
      })
    }

    const notebook = getNotebookState(courseId, assignment.id)
    if (attachNotebookDrawing && notebook.drawingDataUrl) {
      uploadFiles.push({
        name: `${assignment.title}-notebook.png`,
        mimeType: 'image/png',
        contentBase64: notebook.drawingDataUrl.split(',')[1] ?? ''
      })
    }
    if (attachNotebookText && notebook.textAnswer.trim()) {
      uploadFiles.push({
        name: `${assignment.title}-notes.txt`,
        mimeType: 'text/plain',
        contentBase64: stringToBase64(notebook.textAnswer)
      })
    }

    const attachments: SubmissionAttachment[] = linksText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((url) => ({ link: { url } }))

    if (uploadFiles.length > 0) {
      const uploaded = (await window.electronAPI.classroom.uploadFilesAsAttachments(
        uploadFiles
      )) as SubmissionAttachment[]
      attachments.push(...uploaded)
    }

    return attachments
  }

  const handleSaveDraft = async (): Promise<void> => {
    if (!submission) {
      setMessage('Submission failed.')
      return
    }
    setSavingDraft(true)
    setMessage(null)
    try {
      const attachments = await collectOptionalAttachments()
      if (attachments.length > 0) {
        await window.electronAPI.classroom.addSubmissionAttachments(
          courseId,
          assignment.id,
          submission.id,
          attachments
        )
      }
      setMessage(attachments.length > 0 ? 'Draft saved.' : 'Draft saved (no attachments).')
      await reload()
    } catch (err) {
      setMessage(parseApiError(err))
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!submission) {
      const error = new Error('Cannot submit assignment: no submission is loaded yet.')
      console.error('[CourseView] Submit blocked before API call.', error)
      setMessage('No submission is available yet. Please wait and try again.')
      return
    }
    if (!courseId || !assignment.id || !submission.id) {
      const error = new Error('Cannot submit assignment: missing required course or submission identifiers.')
      console.error('[CourseView] Submit blocked before API call.', {
        error,
        courseId,
        assignmentId: assignment.id,
        submissionId: submission.id
      })
      setMessage('Unable to submit because required assignment details are missing.')
      return
    }
    const submitAssignmentFn = window.electronAPI?.classroom?.submitAssignment
    if (typeof submitAssignmentFn !== 'function') {
      const error = new Error('Cannot submit assignment: submit API is unavailable in renderer context.')
      console.error('[CourseView] Submit blocked before API call.', error)
      setMessage('Submission is currently unavailable. Please restart the app and try again.')
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const attachments = await collectOptionalAttachments()
      const hasExistingAttachments = (submission.assignmentSubmission?.attachments?.length ?? 0) > 0
      if (attachments.length === 0 && !hasExistingAttachments) {
        setMessage('You are submitting without attachments')
      }
      if (attachments.length > 0) {
        await window.electronAPI.classroom.addSubmissionAttachments(
          courseId,
          assignment.id,
          submission.id,
          attachments
        )
      }
      console.debug('[CourseView] Calling submitAssignment API.', {
        courseId,
        assignmentId: assignment.id,
        submissionId: submission.id
      })
      await submitAssignmentFn(courseId, assignment.id, submission.id)
      recordSubmissionAchievement(assignment, new Date().toISOString())
      setMessage('Submitted successfully.')
      await reload()
    } catch (err) {
      console.error('[CourseView] Submit assignment failed.', err)
      setMessage(parseApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitClick = (): void => {
    console.debug('[CourseView] Submit Assignment button clicked.', {
      courseId,
      assignmentId: assignment.id,
      submissionId: submission?.id
    })
    void handleSubmit()
  }

  const handleUnsubmit = async (): Promise<void> => {
    if (!submission) {
      setMessage('Submission failed.')
      return
    }
    setUnsubmitting(true)
    setMessage(null)
    try {
      await window.electronAPI.classroom.unsubmitAssignment(courseId, assignment.id, submission.id)
      setMessage('Submission reclaimed.')
      await reload()
    } catch (err) {
      setMessage(parseApiError(err))
    } finally {
      setUnsubmitting(false)
    }
  }

  const handleClearSubmission = async (): Promise<void> => {
    setClearing(true)
    setMessage(null)
    try {
      setSelectedFiles([])
      setLinksText('')
      setAttachNotebookDrawing(false)
      setAttachNotebookText(false)
      if (submission) {
        const attachmentIds =
          submission.assignmentSubmission?.attachments
            ?.map((attachment) => attachment.id)
            .filter((id): id is string => Boolean(id)) ?? []
        if (attachmentIds.length > 0) {
          await window.electronAPI.classroom.removeSubmissionAttachments(
            courseId,
            assignment.id,
            submission.id,
            attachmentIds
          )
        }
        await reload()
      }
      setMessage('Submission cleared.')
    } catch (err) {
      setMessage(parseApiError(err))
    } finally {
      setClearing(false)
    }
  }

  const linkedMaterials = getMaterialItems(assignment.materials)
  const orderedExtensions = [...extensions]
  const canSubmit =
    !submitting && Boolean(courseId) && Boolean(assignment.id) && (!submission || submission.state !== 'TURNED_IN')
  const canSaveDraft = !savingDraft && !!submission
  const canUnsubmit = !!submission && submission.state === 'TURNED_IN' && !unsubmitting
  const canClear = !clearing

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{assignment.title}</div>
          <div style={{ color: '#5f6368', fontSize: 13 }}>{formatDueDate(assignment)}</div>
          {notifications.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notifications.map((notification) => {
                const notificationStyle = NOTIFICATION_STYLE_BY_SEVERITY[notification.severity]
                return (
                <div
                  key={notification.id}
                  style={{
                    fontSize: 12,
                    borderRadius: 8,
                    padding: '6px 8px',
                    border: `1px solid ${notificationStyle.border}`,
                    background: notificationStyle.background,
                    color: notificationStyle.color
                  }}
                >
                  <strong>{notification.severity === 'warning' ? 'Warning' : 'Info'}:</strong>{' '}
                  {notification.message}
                </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, border: '1px solid #dadce0', borderRadius: 12, padding: '2px 8px' }}>
          {submissionLabel(submission?.state)}
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gap: 12,
          gridTemplateColumns: openNotebook ? ASSIGNMENT_WORKSPACE_WITH_NOTEBOOK : ASSIGNMENT_WORKSPACE_DEFAULT
        }}
      >
        {openNotebook && (
          <div>
            <NotebookPanel
              open={openNotebook}
              onClose={() => setOpenNotebook(false)}
              assignmentTitle={assignment.title}
              courseId={courseId}
              courseWorkId={assignment.id}
            />
          </div>
        )}
        <div>
          {assignment.description && <div style={{ whiteSpace: 'pre-wrap' }}>{assignment.description}</div>}
          {linkedMaterials.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Materials</div>
              {linkedMaterials.map((item) => (
                <button
                  key={`${item.url}:${item.label}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 6,
                    textAlign: 'left',
                    border: '1px solid #e8eaed',
                    borderRadius: 8,
                    background: '#f8f9fa',
                    padding: '8px 10px'
                  }}
                  onClick={() => openingMaterial(item.url)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Your Work</div>
            <input type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} />
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              placeholder="Optional links (one per line)"
              style={{ width: '100%', minHeight: 70, marginTop: 8 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <aside
            style={{
              border: '1px solid #e8eaed',
              borderRadius: 10,
              padding: 10,
              background: '#fbfcff',
              height: 'fit-content',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: 0.3, color: '#5f6368', fontWeight: 700 }}>
              SUBMISSION PANEL
            </div>
            <button
              type="button"
              style={{
                width: '100%',
                border: '1px solid #dadce0',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
                background: '#fff'
              }}
              onClick={() => setOpenNotebook((x) => !x)}
            >
              {openNotebook ? 'Hide Notebook' : 'Notebook'}
            </button>
            <button
              type="button"
              style={{
                width: '100%',
                border: '1px solid #dadce0',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
                background: '#fff'
              }}
              onClick={() => {
                void handleSaveDraft()
              }}
              disabled={!canSaveDraft}
            >
              {savingDraft ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              type="button"
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 10,
                padding: '12px 12px',
                fontWeight: 700,
                color: '#fff',
                background: canSubmit ? '#1a73e8' : '#9aa0a6'
              }}
              onClick={handleSubmitClick}
              disabled={!canSubmit}
            >
              {submitting ? 'Submitting…' : 'Submit Assignment'}
            </button>
            {canUnsubmit && (
              <button
                type="button"
                style={{
                  width: '100%',
                  border: '1px solid #dadce0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontWeight: 700,
                  background: '#fff'
                }}
                onClick={() => {
                  void handleUnsubmit()
                }}
                disabled={!canUnsubmit}
              >
                {unsubmitting ? 'Unsubmitting…' : 'Unsubmit'}
              </button>
            )}
            <button
              type="button"
              style={{
                width: '100%',
                border: '1px solid #dadce0',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
                background: '#fff'
              }}
              onClick={() => {
                void handleClearSubmission()
              }}
              disabled={!canClear}
            >
              {clearing ? 'Clearing…' : 'Clear Submission'}
            </button>
            <label style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={attachNotebookText}
                onChange={(e) => setAttachNotebookText(e.target.checked)}
              />{' '}
              Attach notebook text
            </label>
            <label style={{ display: 'block', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={attachNotebookDrawing}
                onChange={(e) => setAttachNotebookDrawing(e.target.checked)}
              />{' '}
              Attach notebook drawing
            </label>
          </aside>

          <aside
            style={{
              border: '1px solid #e8eaed',
              borderRadius: 10,
              padding: 10,
              background: '#fff',
              height: 'fit-content'
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: 0.3, color: '#5f6368', fontWeight: 700, marginBottom: 8 }}>
              EXTENSIONS PANEL
            </div>
            <button
              type="button"
              style={{
                width: '100%',
                border: '1px solid #dadce0',
                borderRadius: 8,
                padding: '8px 10px',
                background: '#fff',
                textAlign: 'left'
              }}
              onClick={() => setExtensionsOpen((x) => !x)}
            >
              {extensionsOpen ? 'Hide Extensions' : 'Open Extensions'}
            </button>
            {extensionsOpen && (
              <div
                style={{
                  marginTop: 8,
                  border: '1px solid #e8eaed',
                  borderRadius: 8,
                  background: '#fff',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                {orderedExtensions.map((extension) => (
                  <button
                    key={extension.id}
                    type="button"
                    style={{
                      border: '1px solid #dadce0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      textAlign: 'left',
                      background: '#fff'
                    }}
                    onClick={() => {
                      void onRunExtension(extension, assignment)
                    }}
                  >
                    {extension.name}
                  </button>
                ))}
                {orderedExtensions.length === 0 && <div style={{ fontSize: 13, color: '#5f6368' }}>No extensions.</div>}
              </div>
            )}
          </aside>
        </div>
      </div>
      {message && <div style={{ marginTop: 8, fontSize: 13 }}>{message}</div>}
    </div>
  )
}

export default function CourseView({ course }: CourseViewProps): React.ReactElement {
  const [assignments, setAssignments] = useState<CourseWork[]>([])
  const [assignmentNotificationsById, setAssignmentNotificationsById] = useState<
    Record<string, AssignmentNotification[]>
  >({})
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [courseWorkExtensions, setCourseWorkExtensions] = useState<ExtensionMetadata[]>([])
  const [activeExtensionResult, setActiveExtensionResult] = useState<{
    assignmentTitle: string
    extensionName: string
    result: ExtensionResult
  } | null>(null)
  const [materialPreviewUrl, setMaterialPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const { accessToken } = await window.electronAPI.auth.getAccessToken()
        const encodedCourseId = encodeURIComponent(course.id)
        const [courseWorkData, announcementsData, studentsData, extensionData] = await Promise.all([
          classroomFetch<{ courseWork?: CourseWork[] }>(
            `/courses/${encodedCourseId}/courseWork?orderBy=dueDate+desc`,
            accessToken
          ),
          classroomFetch<{ announcements?: Announcement[] }>(
            `/courses/${encodedCourseId}/announcements?orderBy=updateTime+desc`,
            accessToken
          ),
          classroomFetch<{ students?: Student[] }>(`/courses/${encodedCourseId}/students`, accessToken),
          window.electronAPI.extensions.getFor('courseWork')
        ])

        if (!active) return
        const loadedAssignments = courseWorkData.courseWork ?? []
        setAssignments(loadedAssignments)
        setAssignmentNotificationsById(
          loadedAssignments.reduce<Record<string, AssignmentNotification[]>>((acc, assignment) => {
            acc[assignment.id] = evaluateAssignmentNotifications(assignment, assignmentNotificationConfig)
            return acc
          }, {})
        )
        setAnnouncements(announcementsData.announcements ?? [])
        setStudents(studentsData.students ?? [])
        setCourseWorkExtensions(extensionData as ExtensionMetadata[])
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadData()
    return () => {
      active = false
    }
  }, [course.id])

  const runExtension = async (extension: ExtensionMetadata, assignment: CourseWork): Promise<void> => {
    const context: ClassroomContext = {
      title: assignment.title,
      description: assignment.description,
      materials: assignment.materials,
      courseId: course.id,
      courseWorkId: assignment.id
    }
    const result = (await window.electronAPI.extensions.run(extension.id, context)) as ExtensionResult
    setActiveExtensionResult({ assignmentTitle: assignment.title, extensionName: extension.name, result })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: '#1a73e8', padding: '24px 40px 0', color: '#fff' }}>
        <h2 style={{ margin: '0 0 4px' }}>{course.name}</h2>
        {course.section && <p style={{ marginTop: 0 }}>{course.section}</p>}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px' }}>
        {loading && <div>Loading course data…</div>}
        {error && <div style={{ color: '#d32f2f' }}>{error}</div>}
        {!loading && !error && (
          <>
            <section>
              <h3>Assignments</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {assignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      courseId={course.id}
                      extensions={courseWorkExtensions}
                      onRunExtension={runExtension}
                      openingMaterial={setMaterialPreviewUrl}
                      notifications={assignmentNotificationsById[assignment.id] ?? []}
                    />
                  ))}
                </div>
                <aside style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 10, background: '#fff', height: 'fit-content', position: 'sticky', top: 0 }}>
                  <h4 style={{ marginTop: 0 }}>Extensions panel</h4>
                  {!activeExtensionResult && <div>Run an extension to view output.</div>}
                  {activeExtensionResult && (
                    <>
                      <div style={{ fontSize: 13, color: '#5f6368' }}>
                        {activeExtensionResult.extensionName} · {activeExtensionResult.assignmentTitle}
                      </div>
                      <div style={{ marginTop: 8 }}>{activeExtensionResult.result.summary}</div>
                      {activeExtensionResult.result.hints.map((hint, idx) => (
                        <div key={`ext-hint:${idx}`}>• {hint}</div>
                      ))}
                    </>
                  )}
                </aside>
              </div>
              {materialPreviewUrl && (
                <div style={{ marginTop: 12, border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8f9fa' }}>
                    <span style={{ fontSize: 12 }}>In-app material preview</span>
                    <button type="button" onClick={() => setMaterialPreviewUrl(null)}>Close</button>
                  </div>
                  <iframe src={materialPreviewUrl} title="material-preview" style={{ width: '100%', height: 420, border: 'none' }} />
                </div>
              )}
            </section>
            <section style={{ marginTop: 20 }}>
              <h3>Announcements</h3>
              {announcements.map((announcement) => (
                <div key={announcement.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  {announcement.title || announcement.text || 'Announcement'}
                </div>
              ))}
              {announcements.length === 0 && <div>No announcements found.</div>}
            </section>
            <section style={{ marginTop: 20 }}>
              <h3>Students</h3>
              {students.map((student) => (
                <div key={student.userId} style={{ marginBottom: 6 }}>
                  {student.profile?.name?.fullName ?? student.userId}
                </div>
              ))}
              {students.length === 0 && <div>No students found.</div>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
