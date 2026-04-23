export const NOTEBOOK_STORAGE_PREFIX = 'openclass:notebook:'

export interface NotebookState {
  drawingDataUrl: string
  strokes: NotebookStroke[]
  textAnswer: string
  pageStyle: 'ruled' | 'grid' | 'blank'
  theme: 'light' | 'dark' | 'wood' | 'minimal'
  autoSave: boolean
}

export interface NotebookStrokePoint {
  x: number
  y: number
}

export interface NotebookStroke {
  points: NotebookStrokePoint[]
  color: string
  width: number
}

export const DEFAULT_NOTEBOOK_STATE: NotebookState = {
  drawingDataUrl: '',
  strokes: [],
  textAnswer: '',
  pageStyle: 'ruled',
  theme: 'light',
  autoSave: true
}

function key(courseId: string, courseWorkId: string): string {
  return `${NOTEBOOK_STORAGE_PREFIX}${courseId}:${courseWorkId}`
}

export function getNotebookState(courseId: string, courseWorkId: string): NotebookState {
  const raw = localStorage.getItem(key(courseId, courseWorkId))
  if (!raw) return { ...DEFAULT_NOTEBOOK_STATE }
  try {
    return { ...DEFAULT_NOTEBOOK_STATE, ...(JSON.parse(raw) as Partial<NotebookState>) }
  } catch {
    return { ...DEFAULT_NOTEBOOK_STATE }
  }
}

export function setNotebookState(courseId: string, courseWorkId: string, state: NotebookState): void {
  localStorage.setItem(key(courseId, courseWorkId), JSON.stringify(state))
}

export function clearNotebookState(courseId: string, courseWorkId: string): void {
  localStorage.removeItem(key(courseId, courseWorkId))
}

export function hasNotebookContent(state: NotebookState): boolean {
  return state.textAnswer.trim().length > 0 || state.strokes.length > 0 || state.drawingDataUrl.length > 0
}

export function listNotebookStates(): Array<{
  courseId: string
  courseWorkId: string
  state: NotebookState
}> {
  const entries: Array<{ courseId: string; courseWorkId: string; state: NotebookState }> = []
  const storageKeys = Object.keys(localStorage)
  for (const storageKey of storageKeys) {
    if (!storageKey.startsWith(NOTEBOOK_STORAGE_PREFIX)) continue
    const rawId = storageKey.replace(NOTEBOOK_STORAGE_PREFIX, '')
    const separator = rawId.indexOf(':')
    if (separator <= 0) continue
    const courseId = rawId.slice(0, separator)
    const courseWorkId = rawId.slice(separator + 1)
    if (!courseId || !courseWorkId) continue
    entries.push({ courseId, courseWorkId, state: getNotebookState(courseId, courseWorkId) })
  }
  return entries
}
