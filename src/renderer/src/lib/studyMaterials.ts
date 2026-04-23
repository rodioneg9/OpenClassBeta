import type { StudyMaterialChunk } from '../types'

const STORAGE_KEY = 'openclass:study-materials:v1'
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function chunkText(sourceName: string, text: string): StudyMaterialChunk[] {
  const clean = normalizeText(text)
  if (!clean) return []
  const chunks: StudyMaterialChunk[] = []
  let index = 0
  let offset = 0
  while (offset < clean.length) {
    const previousOffset = offset
    const end = Math.min(clean.length, offset + CHUNK_SIZE)
    chunks.push({
      id: `${sourceName}:${index}`,
      sourceName,
      text: clean.slice(offset, end)
    })
    if (end === clean.length) break
    offset = Math.max(end - CHUNK_OVERLAP, 0)
    if (offset <= previousOffset) {
      break
    }
    index += 1
  }
  return chunks
}

async function fileToText(file: File): Promise<string> {
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
    return file.text()
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    const fallback = new TextDecoder('latin1').decode(bytes)
    return fallback.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
  }
}

export async function createChunksFromFiles(files: File[]): Promise<StudyMaterialChunk[]> {
  const allChunks: StudyMaterialChunk[] = []
  for (const file of files) {
    const text = await fileToText(file)
    allChunks.push(...chunkText(file.name, text))
  }
  return allChunks
}

export function loadStudyMaterialChunks(): StudyMaterialChunk[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as StudyMaterialChunk[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudyMaterialChunks(chunks: StudyMaterialChunk[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chunks))
}
