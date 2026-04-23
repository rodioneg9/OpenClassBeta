import type { Material } from '../classroom-api'

export type ExtensionSupportType = 'courseWork' | 'announcements' | 'notebook'

export interface ClassroomContext {
  title: string
  description?: string
  materials?: Material[]
  courseId: string
  courseWorkId?: string
  formUrl?: string
}

export interface ExtensionResult {
  summary: string
  hints: string[]
  raw?: unknown
}

export interface Extension {
  id: string
  name: string
  description: string
  supports: ExtensionSupportType[]
  run: (context: ClassroomContext) => Promise<ExtensionResult>
}

export interface ExtensionMetadata {
  id: string
  name: string
  description: string
  supports: ExtensionSupportType[]
}
