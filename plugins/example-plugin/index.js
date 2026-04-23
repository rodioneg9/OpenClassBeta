/**
 * Example OpenClass plugin.
 * Demonstrates the plugin API: addPanel, extendCoursePage, addAction.
 */

const id = 'example-plugin'
const name = 'Example Plugin'
const version = '1.0.0'

/**
 * @param {import('../../src/main/plugin-loader').PluginAPI} api
 */
function init(api) {
  // Register a sidebar panel
  api.addPanel({
    id: 'example-panel',
    title: 'Plugin Panel',
    html: `
      <div style="padding:16px;font-family:sans-serif">
        <h3 style="color:#1a73e8;margin:0 0 8px">Example Plugin Panel</h3>
        <p style="color:#5f6368;font-size:13px">
          This panel was added by the Example Plugin.
          You can render custom HTML content here.
        </p>
      </div>
    `
  })

  // Register a course page extension (adds a custom tab to every course)
  api.extendCoursePage({
    tabTitle: 'Plugin Tab',
    html: `
      <div style="padding:24px;font-family:sans-serif">
        <h3 style="color:#1a73e8;margin:0 0 12px">Plugin Course Extension</h3>
        <p style="color:#5f6368;font-size:14px">
          This tab is injected by the Example Plugin into every course view.
        </p>
      </div>
    `
  })

  // Register a plugin action
  api.addAction({
    id: 'example-action',
    label: 'Say Hello',
    handler: () => {
      // eslint-disable-next-line no-console
      console.log('[example-plugin] Hello from the Example Plugin action!')
    }
  })
}

module.exports = { id, name, version, init }
