import { app } from 'electron'
import { join } from 'path'
import { readdirSync, existsSync } from 'fs'

export interface PluginPanel {
  id: string
  title: string
  html: string
}

export interface CoursePageExtension {
  tabTitle: string
  html: string
}

export interface PluginAction {
  id: string
  label: string
  handler: () => void
}

export interface Plugin {
  id: string
  name: string
  version: string
  panels: PluginPanel[]
  coursePageExtensions: CoursePageExtension[]
  actions: PluginAction[]
}

interface PluginModule {
  id: string
  name: string
  version: string
  init: (api: PluginAPI) => void
}

interface PluginAPI {
  addPanel: (panel: PluginPanel) => void
  extendCoursePage: (ext: CoursePageExtension) => void
  addAction: (action: PluginAction) => void
}

interface PluginRegistry {
  plugins: Plugin[]
}

function getPluginsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'plugins')
  }
  return join(app.getAppPath(), 'plugins')
}

export async function loadPlugins(): Promise<PluginRegistry> {
  const pluginsDir = getPluginsDir()
  const registry: PluginRegistry = { plugins: [] }

  if (!existsSync(pluginsDir)) {
    return registry
  }

  let entries: string[]
  try {
    entries = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return registry
  }

  for (const entry of entries) {
    const pluginPath = join(pluginsDir, entry, 'index.js')
    if (!existsSync(pluginPath)) continue

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(pluginPath) as PluginModule
      if (!mod.id || !mod.name || typeof mod.init !== 'function') {
        console.warn(`[plugin-loader] Skipping invalid plugin at ${pluginPath}`)
        continue
      }

      const plugin: Plugin = {
        id: mod.id,
        name: mod.name,
        version: mod.version ?? '0.0.0',
        panels: [],
        coursePageExtensions: [],
        actions: []
      }

      const api: PluginAPI = {
        addPanel: (panel) => plugin.panels.push(panel),
        extendCoursePage: (ext) => plugin.coursePageExtensions.push(ext),
        addAction: (action) => plugin.actions.push(action)
      }

      mod.init(api)
      registry.plugins.push(plugin)
      console.log(`[plugin-loader] Loaded plugin: ${mod.name} v${plugin.version}`)
    } catch (err) {
      console.error(`[plugin-loader] Failed to load plugin at ${pluginPath}:`, err)
    }
  }

  return registry
}
