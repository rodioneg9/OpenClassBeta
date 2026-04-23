import { randomBytes } from 'crypto'

const BASE_URL = 'https://classroom.googleapis.com/v1'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3'

export class ClassroomApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    const sanitized = body.length > 400 ? `${body.slice(0, 400)}…` : body
    super(`Classroom API error ${status}: ${sanitized}`)
    this.name = 'ClassroomApiError'
    this.status = status
    this.body = body
  }
}

async function classroomFetch<T>(path: string, accessToken: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ClassroomApiError(response.status, body)
  }

  if (response.status === 204) {
    return {} as T
  }

  const text = await response.text()
  if (!text) {
    return {} as T
  }

  return JSON.parse(text) as T
}

export interface Course {
  id: string
  name: string
  section?: string
  descriptionHeading?: string
  description?: string
  room?: string
  ownerId?: string
  courseState?: string
  enrollmentCode?: string
  courseGroupEmail?: string
  teacherGroupEmail?: string
  calendarId?: string
  guardiansEnabled?: boolean
}

export interface CourseWork {
  id: string
  title: string
  description?: string
  courseId: string
  state?: string
  dueDate?: { year: number; month: number; day: number }
  dueTime?: { hours: number; minutes: number }
  maxPoints?: number
  workType?: string
  assigneeMode?: string
  submissionModificationMode?: string
  creationTime?: string
  updateTime?: string
  alternateLink?: string
  materials?: Material[]
}

export interface StudentSubmission {
  id: string
  courseId: string
  courseWorkId: string
  userId: string
  creationTime?: string
  updateTime?: string
  state?: string
  late?: boolean
  draftGrade?: number
  assignedGrade?: number
  alternateLink?: string
  courseWorkType?: string
  associatedWithDeveloper?: boolean
  assignmentSubmission?: {
    attachments?: SubmissionAttachment[]
  }
}

export interface SubmissionAttachment {
  id?: string
  driveFile?: {
    id: string
    title?: string
    alternateLink?: string
  }
  link?: {
    url: string
    title?: string
  }
}

export interface UploadableFile {
  name: string
  mimeType: string
  contentBase64: string
}

export interface Announcement {
  id: string
  courseId: string
  text?: string
  title?: string
  description?: string
  state?: string
  alternateLink?: string
  creationTime?: string
  updateTime?: string
  creatorUserId?: string
  materials?: Material[]
}

export interface Material {
  link?: {
    url?: string
    title?: string
  }
  driveFile?: {
    driveFile?: {
      alternateLink?: string
      title?: string
    }
  }
  youtubeVideo?: {
    alternateLink?: string
    title?: string
  }
  form?: {
    formUrl?: string
    title?: string
  }
}

export interface Student {
  courseId: string
  userId: string
  profile?: {
    id: string
    name?: { givenName?: string; familyName?: string; fullName?: string }
    emailAddress?: string
    photoUrl?: string
  }
}

export async function getCourses(accessToken: string): Promise<Course[]> {
  const data = await classroomFetch<{ courses?: Course[] }>('/courses?courseStates=ACTIVE', accessToken)
  return data.courses ?? []
}

export async function getCourseWork(courseId: string, accessToken: string): Promise<CourseWork[]> {
  const data = await classroomFetch<{ courseWork?: CourseWork[] }>(
    `/courses/${courseId}/courseWork?orderBy=dueDate+desc`,
    accessToken
  )
  return data.courseWork ?? []
}

export async function getSubmissions(
  courseId: string,
  courseWorkId: string,
  accessToken: string
): Promise<StudentSubmission[]> {
  const data = await classroomFetch<{ studentSubmissions?: StudentSubmission[] }>(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
    accessToken
  )
  return data.studentSubmissions ?? []
}

export async function getMySubmission(
  courseId: string,
  courseWorkId: string,
  accessToken: string
): Promise<StudentSubmission | null> {
  const data = await classroomFetch<{ studentSubmissions?: StudentSubmission[] }>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions?userId=me`,
    accessToken
  )
  return data.studentSubmissions?.[0] ?? null
}

export async function getAnnouncements(courseId: string, accessToken: string): Promise<Announcement[]> {
  const data = await classroomFetch<{ announcements?: Announcement[] }>(
    `/courses/${courseId}/announcements?orderBy=updateTime+desc`,
    accessToken
  )
  return data.announcements ?? []
}

export async function getStudents(courseId: string, accessToken: string): Promise<Student[]> {
  const data = await classroomFetch<{ students?: Student[] }>(
    `/courses/${courseId}/students`,
    accessToken
  )
  return data.students ?? []
}

export async function submitAssignment(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  accessToken: string
): Promise<StudentSubmission> {
  return classroomFetch<StudentSubmission>(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}:turnIn`,
    accessToken,
    { method: 'POST', body: '{}' }
  )
}

export async function unsubmitAssignment(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  accessToken: string
): Promise<StudentSubmission> {
  return classroomFetch<StudentSubmission>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:reclaim`,
    accessToken,
    { method: 'POST', body: '{}' }
  )
}

export async function addSubmissionAttachments(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  attachments: SubmissionAttachment[],
  accessToken: string
): Promise<StudentSubmission> {
  return classroomFetch<StudentSubmission>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:modifyAttachments`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        addAttachments: attachments
      })
    }
  )
}

export async function removeSubmissionAttachments(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  attachmentIds: string[],
  accessToken: string
): Promise<StudentSubmission> {
  if (attachmentIds.length === 0) {
    throw new Error('Cannot remove attachments: no attachment IDs provided.')
  }
  return classroomFetch<StudentSubmission>(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:modifyAttachments`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        removeAttachments: attachmentIds
      })
    }
  )
}

async function uploadDriveFile(
  file: UploadableFile,
  accessToken: string
): Promise<{ id: string; name?: string; webViewLink?: string }> {
  const metadata = {
    name: file.name,
    mimeType: file.mimeType
  }

  const boundary = `boundary_${randomBytes(24).toString('hex')}`
  const delimiter = `--${boundary}`
  const closeDelimiter = `--${boundary}--`
  const body =
    `${delimiter}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `${delimiter}\r\n` +
    `Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    `${file.contentBase64}\r\n` +
    `${closeDelimiter}`

  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Drive upload failed ${response.status}: ${errText}`)
  }

  const uploaded = (await response.json()) as { id: string }
  const detailsRes = await fetch(
    `${DRIVE_API_URL}/files/${encodeURIComponent(uploaded.id)}?fields=id,name,webViewLink`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  )

  if (!detailsRes.ok) {
    return { id: uploaded.id }
  }
  return (await detailsRes.json()) as { id: string; name?: string; webViewLink?: string }
}

export async function uploadDriveFilesAsAttachments(
  files: UploadableFile[],
  accessToken: string
): Promise<SubmissionAttachment[]> {
  const attachments: SubmissionAttachment[] = []
  for (const file of files) {
    const uploaded = await uploadDriveFile(file, accessToken)
    attachments.push({
      driveFile: {
        id: uploaded.id,
        title: uploaded.name,
        alternateLink: uploaded.webViewLink
      }
    })
  }
  return attachments
}
