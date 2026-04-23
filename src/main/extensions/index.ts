import { ExtensionManager } from './manager'
import { formAssistantExtension } from './form-assistant'
import { notebookExtension } from './notebook-extension'
import { achievementsExtension } from './achievements-extension'
import { studyMaterialAiExtension } from './study-material-extension'
import { submissionExtension } from './submission-extension'

const extensionManager = new ExtensionManager()

extensionManager.registerExtension(formAssistantExtension)
extensionManager.registerExtension(notebookExtension)
extensionManager.registerExtension(achievementsExtension)
extensionManager.registerExtension(studyMaterialAiExtension)
extensionManager.registerExtension(submissionExtension)

export { extensionManager }
export * from './types'
