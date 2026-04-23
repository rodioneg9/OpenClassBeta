import React, { useState } from 'react'
import type { StudyMaterialChunk } from '../types'
import { createChunksFromFiles, loadStudyMaterialChunks, saveStudyMaterialChunks } from '../lib/studyMaterials'

export default function StudyMaterialPage(): React.ReactElement {
  const [chunks, setChunks] = useState<StudyMaterialChunk[]>(loadStudyMaterialChunks())
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    const created = await createChunksFromFiles(files)
    const next = [...chunks, ...created]
    setChunks(next)
    saveStudyMaterialChunks(next)
  }

  const handleAsk = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const result = (await window.electronAPI.studyMaterial.ask(question, chunks)) as { answer: string }
      setAnswer(result.answer)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ marginTop: 0 }}>Study Material Mode</h2>
      <div style={{ marginBottom: 10 }}>
        Upload textbooks/notes (PDF or text) and ask restricted questions.
      </div>
      <input type="file" accept=".txt,.md,.pdf,text/plain,application/pdf" multiple onChange={(e) => { void handleUpload(e) }} />
      <div style={{ marginTop: 10, fontSize: 13 }}>Indexed chunks: {chunks.length}</div>
      <div style={{ marginTop: 12 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question based on uploaded materials..."
          style={{ width: '100%', minHeight: 90 }}
        />
      </div>
      <button type="button" onClick={() => { void handleAsk() }} disabled={loading || !question.trim()}>
        {loading ? 'Asking…' : 'Ask AI'}
      </button>
      {answer && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{answer}</div>}
      {error && <div style={{ marginTop: 10, color: '#d32f2f' }}>{error}</div>}
    </div>
  )
}
