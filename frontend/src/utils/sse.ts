interface StreamSSEOptions<TEvent> {
    url: string
    onEvent: (event: TEvent) => void
    signal?: AbortSignal
}

/** Incremental SSE framing; a blank line dispatches one JSON event. */
class SSEDecoder<TEvent> {
    private buffer = ''
    private data: string[] = []
    private readonly onEvent: (event: TEvent) => void

    constructor(onEvent: (event: TEvent) => void) {
        this.onEvent = onEvent
    }

    push(text: string, final = false): void {
        this.buffer += text
        while (true) {
            const index = this.buffer.search(/[\r\n]/)
            if (index < 0) return
            // CRLF can straddle two network chunks.
            if (!final && index === this.buffer.length - 1 && this.buffer[index] === '\r') return
            const line = this.buffer.slice(0, index)
            const width = this.buffer[index] === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1
            this.buffer = this.buffer.slice(index + width)
            if (line === '') {
                const payload = this.data.join('\n')
                this.data = []
                if (payload && payload.trim() !== '[DONE]') {
                    // Propagate malformed JSON and consumer errors to the caller.
                    this.onEvent(JSON.parse(payload) as TEvent)
                }
            } else if (line.startsWith('data:')) {
                const value = line.slice(5)
                this.data.push(value.startsWith(' ') ? value.slice(1) : value)
            }
        }
    }
}

export async function streamSSE<TEvent>({ url, onEvent, signal }: StreamSSEOptions<TEvent>): Promise<void> {
    const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
        signal,
    })
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    const events = new SSEDecoder(onEvent)
    let finished = false
    try {
        while (true) {
            signal?.throwIfAborted()
            const { done, value } = await reader.read()
            if (done) {
                events.push(decoder.decode(), true)
                finished = true
                break
            }
            signal?.throwIfAborted()
            events.push(decoder.decode(value, { stream: true }))
        }
    } finally {
        // Stop consuming on parser/handler failure and always release the lock.
        try {
            if (!finished) await reader.cancel()
        } catch {
            // Preserve the original failure if the transport is already closed.
        } finally {
            reader.releaseLock()
        }
    }
}
