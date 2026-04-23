import type { ClassroomContext, Extension, ExtensionResult } from './types'

function getNotebookHint(context: ClassroomContext): string {
  if (context.title.toLowerCase().includes('math') || context.title.toLowerCase().includes('geometry')) {
    return 'Use grid paper mode for calculations and diagrams.'
  }
  return 'Use ruled paper mode for structured notes and key points.'
}

export const notebookExtension: Extension = {
  id: 'notebook-extension',
  name: 'Notebook Extension',
  description: 'Provides notebook guidance for the current assignment.',
  supports: ['courseWork', 'notebook'],
  run: async (context: ClassroomContext): Promise<ExtensionResult> => {
    return {
      summary: `Notebook workspace is ready for "${context.title}".`,
      hints: [getNotebookHint(context), 'Attach your notebook page when submitting if needed.']
    }
  }
}
