import { useEffect, useRef, useState } from 'react'

const initialMessage = {
  role: 'assistant',
  content: 'Hi! I can query and update your CRM. Try: "show me all uncalled Ohio coaches" or "how many deals are in Proposal stage?"',
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([initialMessage])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, messages, loading])

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput || loading) {
      return
    }

    const nextMessages = [...messages, { role: 'user', content: trimmedInput }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Assistant request failed')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: data.response || 'Done.' },
      ])
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: `Sorry, I ran into an error: ${error.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[480px] w-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl md:bottom-20 md:right-6 md:w-96">
          <div className="flex items-center justify-between bg-[#1a1a2e] px-4 py-3 text-white">
            <h2 className="text-sm font-semibold">XIQ Assistant</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded px-2 text-lg leading-none text-white/80 hover:text-white"
              aria-label="Close XIQ Assistant"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-[#1a1a2e] text-white'
                      : 'whitespace-pre-wrap bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] animate-pulse rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900">...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#1a1a2e] focus:ring-1 focus:ring-[#1a1a2e]"
              disabled={loading}
            />
            <button
              type="submit"
              className="rounded-lg bg-[#1a1a2e] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#1a1a2e] text-xl text-white shadow-lg md:bottom-6 md:right-6"
        aria-label="Toggle XIQ Assistant"
      >
        ✦
      </button>
    </>
  )
}
