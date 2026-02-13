interface StreamSSEOptions<TEvent> {
    url: string
    onEvent: (event: TEvent) => void
}

export async function streamSSE<TEvent>({ url, onEvent }: StreamSSEOptions<TEvent>): Promise<void> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'text/event-stream',
        },
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
        throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const rawLine of lines) {
            const line = rawLine.trim()
            if (!line.startsWith('data:')) {
                continue
            }

            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') {
                continue
            }

            try {
                onEvent(JSON.parse(payload) as TEvent)
            } catch (error) {
                console.error('Failed to parse SSE data:', error)
            }
        }
    }
}
