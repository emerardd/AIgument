import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

// Load real TypeScript modules that only have type imports.
async function load(relativePath) {
  const source = readFileSync(resolve(import.meta.dirname, '..', relativePath), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { createRunController, TRUNCATED_MESSAGE } = await load('src/utils/runController.ts')
const { reduceAgentDebateEvent, initialAgentDebateRun } = await load('src/features/debate/agentDebateReducer.ts')
const { reduceDialecticEvent, initialDialecticRun } = await load('src/features/dialectic/dialecticReducer.ts')

/** A fake stream that waits for the test to push events and then close. */
function controllableStream() {
  let push, fail, close, signal
  const done = new Promise(resolveDone => {
    close = resolveDone
  })
  const stream = async (onEvent, onError, abortSignal) => {
    push = onEvent
    fail = onError
    signal = abortSignal
    abortSignal.addEventListener('abort', () => close())
    await done
  }
  return { stream, push: e => push(e), fail: e => fail(e), close: () => close(), signal: () => signal }
}

function recorder() {
  const events = []
  const finishes = []
  return {
    events,
    finishes,
    callbacks: {
      onEvent: e => events.push(e.type),
      onFinish: (outcome, error) => finishes.push([outcome, error]),
    },
  }
}

test('completed run reports completed once', async () => {
  const run = createRunController()
  const s = controllableStream()
  const r = recorder()
  const pending = run.start(s.stream, r.callbacks)
  s.push({ type: 'session' })
  s.push({ type: 'complete' })
  s.push({ type: 'argument' }) // after complete: ignored
  s.close()
  assert.equal(await pending, 'completed')
  assert.deepEqual(r.events, ['session', 'complete'])
  assert.deepEqual(r.finishes, [['completed', undefined]])
})

test('stream closing without complete is reported as truncated', async () => {
  const run = createRunController()
  const s = controllableStream()
  const r = recorder()
  const pending = run.start(s.stream, r.callbacks)
  s.push({ type: 'session' })
  s.close()
  assert.equal(await pending, 'truncated')
  assert.deepEqual(r.finishes, [['truncated', TRUNCATED_MESSAGE]])
})

test('error event and transport error both fail with their message', async () => {
  const run = createRunController()
  for (const trigger of [s => s.push({ type: 'error', error: 'model failed' }), s => s.fail(new Error('model failed'))]) {
    const s = controllableStream()
    const r = recorder()
    const pending = run.start(s.stream, r.callbacks)
    trigger(s)
    s.close()
    assert.equal(await pending, 'failed')
    assert.deepEqual(r.finishes, [['failed', 'model failed']])
    assert.deepEqual(r.events, [])
  }
})

test('cancel aborts the stream and reports cancelled', async () => {
  const run = createRunController()
  const s = controllableStream()
  const r = recorder()
  const pending = run.start(s.stream, r.callbacks)
  run.cancel()
  assert.equal(s.signal().aborted, true)
  assert.equal(await pending, 'cancelled')
  assert.deepEqual(r.finishes, [['cancelled', undefined]])
})

test('restarting drops every callback from the superseded run', async () => {
  const run = createRunController()
  const first = controllableStream()
  const firstRecorder = recorder()
  const firstPending = run.start(first.stream, firstRecorder.callbacks)

  const second = controllableStream()
  const secondRecorder = recorder()
  const secondPending = run.start(second.stream, secondRecorder.callbacks)

  assert.equal(first.signal().aborted, true)
  first.push({ type: 'argument' }) // late event from the old run
  second.push({ type: 'complete' })
  second.close()

  assert.equal(await firstPending, 'cancelled')
  assert.equal(await secondPending, 'completed')
  assert.deepEqual(firstRecorder.events, [])
  assert.deepEqual(firstRecorder.finishes, [], 'old run must not touch the new run state')
  assert.deepEqual(secondRecorder.events, ['complete'])
})

test('dispose stops the run without callbacks', async () => {
  const run = createRunController()
  const s = controllableStream()
  const r = recorder()
  const pending = run.start(s.stream, r.callbacks)
  run.dispose()
  await pending
  assert.deepEqual(r.finishes, [])
})

test('agent debate reducer streams arguments into one message per round and side', () => {
  let state = initialAgentDebateRun
  state = reduceAgentDebateEvent(state, { type: 'session', session_id: 7 })
  state = reduceAgentDebateEvent(state, { type: 'round_start', round: 2 })
  state = reduceAgentDebateEvent(state, { type: 'thinking', side: 'pro', content: { core_stance: 'x' }, confidence: 0.8 })
  state = reduceAgentDebateEvent(state, { type: 'argument', side: 'pro', content: '部分' })
  state = reduceAgentDebateEvent(state, { type: 'argument', side: 'pro', content: '部分内容' })
  state = reduceAgentDebateEvent(state, { type: 'argument_complete', side: 'pro', round: 2, content: '完整内容' })
  state = reduceAgentDebateEvent(state, { type: 'argument', side: 'con', content: '反方' })

  assert.equal(state.sessionId, 7)
  // events without a round fall back to the current round (not a stale closure value)
  assert.equal(state.thinkings[0].round, 2)
  assert.deepEqual(state.messages.map(m => [m.round, m.role, m.content]), [[2, '正方', '完整内容'], [2, '反方', '反方']])
  assert.equal(state.messages[0].confidence, 0.8)
})

test('agent debate reducer keeps one evaluation per round and records the verdict', () => {
  let state = { ...initialAgentDebateRun, currentRound: 1 }
  state = reduceAgentDebateEvent(state, { type: 'evaluation', round: 1, round_winner: 'pro' })
  state = reduceAgentDebateEvent(state, { type: 'evaluation', round: 1, round_winner: 'con' })
  state = reduceAgentDebateEvent(state, { type: 'verdict', winner: 'con', margin: 'decisive' })
  assert.deepEqual(state.evaluations.map(e => e.round_winner), ['con'])
  assert.equal(state.verdict.winner, 'con')
  assert.equal(state.verdict.margin, 'decisive')
  assert.equal(reduceAgentDebateEvent(state, { type: 'opening' }), state)
})

test('dialectic reducer collects rounds, fallacies and the final tree', () => {
  let state = initialDialecticRun
  state = reduceDialecticEvent(state, { type: 'round_start', round: 1 })
  state = reduceDialecticEvent(state, { type: 'thesis', round: 1, content: '正' })
  state = reduceDialecticEvent(state, { type: 'antithesis', round: 1, content: '反' })
  state = reduceDialecticEvent(state, { type: 'synthesis', round: 1, content: '合' })
  state = reduceDialecticEvent(state, { type: 'fallacy', round: 1, items: [{ type: '稻草人' }] })
  state = reduceDialecticEvent(state, { type: 'tree_update', nodes: [{ id: 'a' }], edges: [] })
  state = reduceDialecticEvent(state, { type: 'complete', tree: { nodes: [{ id: 'final' }], edges: [] } })

  assert.deepEqual(state.messages.map(m => m.role), ['正题', '反题', '合题'])
  assert.equal(state.fallaciesByRound[1][0].type, '稻草人')
  assert.equal(state.tree.nodes[0].id, 'final')
})
