// Shared TypeScript types for the renderer process.
// These mirror the shapes returned by the Google Classroom API.

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
  alternateLink?: string
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

export type ExtensionSupportType = 'courseWork' | 'announcements' | 'notebook'

export interface ClassroomContext {
  title: string
  description?: string
  materials?: Material[]
  courseId: string
  courseWorkId?: string
  formUrl?: string
  notebookText?: string
  studyMaterialContext?: string[]
}

export interface ExtensionMetadata {
  id: string
  name: string
  description: string
  supports: ExtensionSupportType[]
}

export interface ExtensionResult {
  summary: string
  hints: string[]
  raw?: unknown
}

export interface StudyMaterialChunk {
  id: string
  sourceName: string
  text: string
}

export interface AchievementStats {
  submittedCount: number
  deadlinesMet: number
  currentStreak: number
  bestStreak: number
  lastSubmittedAt?: string
  subjects: Record<string, number>
  unlocked: string[]
}
