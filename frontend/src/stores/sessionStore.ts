export interface SessionState<TMessage> {
    messages: TMessage[]
    isLoading: boolean
    error: string | null
}

export const createSessionState = <TMessage>(messages: TMessage[] = []): SessionState<TMessage> => ({
    messages,
    isLoading: false,
    error: null,
})
