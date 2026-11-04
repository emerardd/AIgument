import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function assertIncludes(fileName, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${fileName} is missing expected interaction contract: ${expected}`)
  }
}

function assertMatches(fileName, content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`${fileName} is missing expected interaction contract: ${label}`)
  }
}

const api = read('src/services/api.ts')
const settingsPage = read('src/pages/Settings.tsx')
const app = read('src/App.tsx')
const detailModal = read('src/components/history/SessionDetailModal.tsx')

assertIncludes('src/services/api.ts', api, 'getProviders')
assertIncludes('src/services/api.ts', api, 'saveProviderKey')
assertIncludes('src/services/api.ts', api, 'testProvider')
assertIncludes('src/services/api.ts', api, '/api/settings/providers')

assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.getProviders')
assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.saveProviderKey')
assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.testProvider')

for (const legacy of ['/api/debate/stream', '/api/debate/single', '/api/chat/stream', '/api/qa/stream']) {
  if (api.includes(legacy)) {
    throw new Error(`src/services/api.ts still references removed endpoint: ${legacy}`)
  }
}
assertIncludes('src/App.tsx', app, '<Route path="/debate"')
assertMatches('src/App.tsx', app, /path="\/chat"[^>]*Navigate/, 'legacy /chat redirects')
assertMatches('src/App.tsx', app, /path="\/qa"[^>]*Navigate/, 'legacy /qa redirects')
assertMatches(
  'src/components/history/SessionDetailModal.tsx',
  detailModal,
  /navigate\('\/socratic-qa',\s*\{\s*state\s*\}\)/,
  'history restores socratic sessions'
)

console.log('Frontend interaction contracts passed.')
