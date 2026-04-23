import type { ClassroomContext, Extension, ExtensionResult } from './types'

export const achievementsExtension: Extension = {
  id: 'achievements-extension',
  name: 'Achievements Extension',
  description: 'Highlights progress-oriented goals for assignment completion.',
  supports: ['courseWork'],
  run: async (context: ClassroomContext): Promise<ExtensionResult> => {
    return {
      summary: `Complete "${context.title}" to improve your submission streak.`,
      hints: ['Submit before the deadline to progress the Deadline Survivor achievement.']
    }
  }
}
