const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export interface StudyMaterialChunk {
  id: string
  sourceName: string
  text: string
}

function sanitizeChunkText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function scoreChunk(question: string, text: string): number {
  const qTerms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
  if (qTerms.length === 0) return 0
  const lowerText = text.toLowerCase()
  return qTerms.reduce((acc, term) => (lowerText.includes(term) ? acc + 1 : acc), 0)
}

export async function askStudyMaterialAI(
  question: string,
  chunks: StudyMaterialChunk[]
): Promise<{ answer: string; usedChunkIds: string[] }> {
  const cleanQuestion = question.trim()
  if (!cleanQuestion) {
    return { answer: 'Not found in study materials', usedChunkIds: [] }
  }

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(cleanQuestion, chunk.text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  if (ranked.length === 0) {
    return { answer: 'Not found in study materials', usedChunkIds: [] }
  }

  const contextBlock = ranked
    .map(
      (item, index) =>
        `[Chunk ${index + 1} | source=${item.chunk.sourceName} | id=${item.chunk.id}]\n${sanitizeChunkText(item.chunk.text)}`
    )
    .join('\n\n')

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is not set. Please set it in your .env file or system environment variables.'
    )
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a restricted tutor. Answer ONLY from provided study material chunks. If evidence is insufficient, answer exactly: "Not found in study materials". Do not use outside knowledge.'
        },
        {
          role: 'user',
          content: `Question: ${cleanQuestion}\n\nStudy Material Chunks:\n${contextBlock}`
        }
      ]
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenRouter request failed ${response.status}: ${body}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    return { answer: 'Not found in study materials', usedChunkIds: ranked.map((x) => x.chunk.id) }
  }

  return {
    answer: content,
    usedChunkIds: ranked.map((x) => x.chunk.id)
  }
}
