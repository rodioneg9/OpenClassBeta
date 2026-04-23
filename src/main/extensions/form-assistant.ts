import type { ClassroomContext, Extension, ExtensionResult } from './types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function buildPrompt(context: ClassroomContext): string {
  const materialUrls =
    context.materials
      ?.flatMap((material) => [
        material.link?.url,
        material.driveFile?.driveFile?.alternateLink,
        material.youtubeVideo?.alternateLink,
        material.form?.formUrl
      ])
      .filter((url): url is string => Boolean(url))
      .join('\n') ?? ''

  return [
    'You are a study assistant for Google Classroom assignments.',
    'Explain tasks and provide non-cheating hints.',
    'Do NOT submit forms, auto-fill answers, or bypass authentication.',
    '',
    `Title: ${context.title}`,
    `Description: ${context.description ?? 'N/A'}`,
    `Course ID: ${context.courseId}`,
    `Course Work ID: ${context.courseWorkId ?? 'N/A'}`,
    `Google Form URL: ${context.formUrl ?? 'N/A'}`,
    '',
    'Materials:',
    materialUrls || 'No materials',
    '',
    'Return JSON with shape:',
    '{ "summary": string, "hints": string[] }',
    'Hints should explain how to solve tasks and summarize requirements.'
  ].join('\n')
}

async function callOpenRouter(context: ClassroomContext): Promise<ExtensionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is not set. Please configure it before using the Form Assistant extension.'
    )
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b:free',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You provide educational explanations and safe study hints only.'
        },
        {
          role: 'user',
          content: buildPrompt(context)
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(
      `OpenRouter API request failed with status ${response.status} (${response.statusText}).`
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content ?? ''

  if (!content) {
    return { summary: 'No response received from assistant.', hints: [] }
  }

  try {
    const parsed = JSON.parse(content) as { summary?: string; hints?: string[] }
    return {
      summary: parsed.summary ?? 'No summary provided.',
      hints: Array.isArray(parsed.hints) ? parsed.hints : [],
      raw: parsed
    }
  } catch {
    return {
      summary: content,
      hints: [],
      raw: content
    }
  }
}

export const formAssistantExtension: Extension = {
  id: 'form-assistant',
  name: 'Form Assistant',
  description: 'Analyzes assignment/form context and returns explanations and hints.',
  supports: ['courseWork'],
  run: async (context: ClassroomContext): Promise<ExtensionResult> => {
    return callOpenRouter(context)
  }
}
