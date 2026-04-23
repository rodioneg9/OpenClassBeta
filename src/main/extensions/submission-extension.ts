import type { ClassroomContext, Extension, ExtensionResult } from './types'

export const submissionExtension: Extension = {
  id: 'submission-extension',
  name: 'Submission Extension',
  description: 'Guides safe manual submission workflow.',
  supports: ['courseWork'],
  run: async (context: ClassroomContext): Promise<ExtensionResult> => {
    return {
      summary: `Review attachments and submit "${context.title}" manually when ready.`,
      hints: [
        'Add links, files, or notebook content before turning in.',
        'Submission is always user-triggered; no automatic turn-in occurs.'
      ]
    }
  }
}
