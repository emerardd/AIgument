import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, after } from 'node:test'
import ts from 'typescript'

// Execute the real TypeScript transport without adding a test framework.
const source = readFileSync(resolve(import.meta.dirname, '../src/utils/sse.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
})
const { streamSSE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

function transport(chunks) {
  let cancelled = false
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
    cancel() { cancelled = true },
  })
  globalThis.fetch = async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  return { body, wasCancelled: () => cancelled }
}

const encode = value => new TextEncoder().encode(value)

test('UTF-8 and CRLF remain intact across single-byte chunks', async () => {
  const bytes = encode(': heartbeat\r\ndata: {"type":"content", "content":"中文"}\r\n\r\ndata: [DONE]\r\n\r\n')
  const connection = transport(Array.from(bytes, byte => Uint8Array.of(byte)))
  const events = []
  await streamSSE({ url: '/stream', onEvent: event => events.push(event) })
  assert.deepEqual(events, [{ type: 'content', content: '中文' }])
  assert.equal(connection.body.locked, false)
})

test('multiline data produces a single event and truncated frames are discarded', async () => {
  transport([encode('event: message\ndata: {"type":\ndata: "complete"}\n\ndata: {"incomplete":true}')])
  const events = []
  await streamSSE({ url: '/stream', onEvent: event => events.push(event) })
  assert.deepEqual(events, [{ type: 'complete' }])
})

test('consumer errors propagate and cancel the reader', async () => {
  const connection = transport([encode('data: {"type":"content"}\n\n'), encode('data: {"type":"complete"}\n\n')])
  await assert.rejects(streamSSE({ url: '/stream', onEvent: () => { throw new Error('render failed') } }), /render failed/)
  assert.equal(connection.wasCancelled(), true)
  assert.equal(connection.body.locked, false)
})

test('malformed payload fails visibly and releases the reader', async () => {
  const connection = transport([encode('data: invalid JSON\n\n'), encode(': pending\n')])
  await assert.rejects(streamSSE({ url: '/stream', onEvent: () => assert.fail('invalid event delivered') }), SyntaxError)
  assert.equal(connection.wasCancelled(), true)
  assert.equal(connection.body.locked, false)
})

test('abort prevents delivery of queued events and releases the reader', async () => {
  const connection = transport([encode('data: {"type":"content"}\n\n')])
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(streamSSE({ url: '/stream', signal: controller.signal, onEvent: () => assert.fail('aborted event delivered') }), { name: 'AbortError' })
  assert.equal(connection.body.locked, false)
})

test('HTTP failures reach the API error handler', async () => {
  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  await assert.rejects(streamSSE({ url: '/stream', onEvent: () => assert.fail('unexpected event') }), /status: 503/)
})
