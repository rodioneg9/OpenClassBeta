import type { ClassroomContext, Extension, ExtensionResult } from './types'

export const studyMaterialAiExtension: Extension = {
  id: 'study-material-ai-extension',
  name: 'Study Material AI Extension',
  description: 'Runs restricted tutoring against uploaded study materials.',
  supports: ['courseWork', 'notebook'],
  run: async (_context: ClassroomContext): Promise<ExtensionResult> => {
    return {
      summary: 'Use Study Material Mode to ask questions only against uploaded books and notes.',
      hints: ['If source material does not contain the answer, the assistant should return Not found in study materials.']
    }
  }
}
