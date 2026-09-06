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
const chatView = read('src/components/chat/ChatView.tsx')
const qaView = read('src/components/qa/QAView.tsx')

assertIncludes('src/services/api.ts', api, 'getProviders')
assertIncludes('src/services/api.ts', api, 'saveProviderKey')
assertIncludes('src/services/api.ts', api, 'testProvider')
assertIncludes('src/services/api.ts', api, '/api/settings/providers')

assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.getProviders')
assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.saveProviderKey')
assertIncludes('src/pages/Settings.tsx', settingsPage, 'settingsAPI.testProvider')
assertIncludes('src/pages/Settings.tsx', settingsPage, '基础对话/问答输出')
assertIncludes('src/pages/Settings.tsx', settingsPage, 'Agent 辩论、角色对话和辩证法引擎始终使用事件流')

assertMatches(
  'src/components/chat/ChatView.tsx',
  chatView,
  /if\s*\(\s*streamMode\s*\)[\s\S]*chatAPI\.streamChat[\s\S]*else[\s\S]*chatAPI\.sendMessage/,
  'chat streamMode branches'
)
assertMatches(
  'src/components/qa/QAView.tsx',
  qaView,
  /if\s*\(\s*streamMode\s*\)[\s\S]*qaAPI\.streamQA[\s\S]*else[\s\S]*qaAPI\.askQuestion/,
  'qa streamMode branches'
)

console.log('Frontend interaction contracts passed.')
