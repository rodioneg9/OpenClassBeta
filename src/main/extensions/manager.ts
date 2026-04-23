import type {
  ClassroomContext,
  Extension,
  ExtensionMetadata,
  ExtensionResult,
  ExtensionSupportType
} from './types'

export class ExtensionManager {
  private readonly extensions = new Map<string, Extension>()

  registerExtension(extension: Extension): void {
    this.extensions.set(extension.id, extension)
  }

  getExtensionsFor(type: ExtensionSupportType): ExtensionMetadata[] {
    return Array.from(this.extensions.values())
      .filter((extension) => extension.supports.includes(type))
      .map((extension) => ({
        id: extension.id,
        name: extension.name,
        description: extension.description,
        supports: extension.supports
      }))
  }

  async runExtension(id: string, context: ClassroomContext): Promise<ExtensionResult> {
    const extension = this.extensions.get(id)
    if (!extension) {
      throw new Error(`Extension not found: ${id}`)
    }

    return extension.run(context)
  }
}
