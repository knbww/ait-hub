import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Sparkles, X } from 'lucide-react'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { streamChat } from '../lib/aiChat'
import type { ChatMessage } from '../lib/aiChat'

const ACCENT = '#750014'

export function AiAssistant() {
  const { session } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [errored, setErrored] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Abort any in-flight stream when the panel closes or the widget unmounts.
  useEffect(() => {
    if (!open) abortRef.current?.abort()
    return () => abortRef.current?.abort()
  }, [open])

  // Only logged-in members get the assistant (it calls a JWT-gated function).
  if (!session) return null

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setErrored(false)
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages([...next, { role: 'assistant', content: '' }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamChat(
        next,
        (delta) => {
          setMessages((cur) => {
            const copy = cur.slice()
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: last.content + delta }
            }
            return copy
          })
        },
        controller.signal,
      )
    } catch {
      setErrored(true)
      setMessages((cur) => {
        const copy = cur.slice()
        const last = copy[copy.length - 1]
        if (last && last.role === 'assistant' && !last.content) copy.pop()
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <>
      {/* Launcher */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('assistant.fab')}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full text-white shadow-[0_8px_32px_0_rgba(117,0,20,0.45)] flex items-center justify-center"
        style={{ background: ACCENT }}
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-6 z-[90] w-[min(380px,calc(100vw-3rem))] h-[min(560px,calc(100vh-8rem))] flex flex-col rounded-3xl border-2 border-white/70 backdrop-blur-[40px] bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.25)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/50">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ background: ACCENT }}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{t('assistant.title')}</p>
                <p className="text-xs text-gray-500 leading-tight">{t('assistant.subtitle')}</p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    abortRef.current?.abort()
                    setMessages([])
                    setErrored(false)
                  }}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {t('assistant.clear')}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex gap-2.5">
                  <Sparkles className="w-5 h-5 shrink-0 mt-1" style={{ color: ACCENT }} />
                  <p className="text-sm text-gray-700 bg-white/60 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    {t('assistant.greeting')}
                  </p>
                </div>
              )}

              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <p
                      className="text-sm text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap break-words"
                      style={{ background: ACCENT }}
                    >
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2.5">
                    <Sparkles className="w-5 h-5 shrink-0 mt-1" style={{ color: ACCENT }} />
                    <p className="text-sm text-gray-800 bg-white/60 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%] whitespace-pre-wrap break-words">
                      {m.content || (
                        <span className="text-gray-400">{t('assistant.thinking')}</span>
                      )}
                    </p>
                  </div>
                ),
              )}

              {errored && <p className="text-xs text-red-600 px-1">{t('assistant.error')}</p>}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-white/50 p-3">
              <div className="flex items-end gap-2 rounded-2xl border border-white/60 bg-white/50 px-3 py-2 focus-within:border-gray-900 transition-colors">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('assistant.placeholder')}
                  className="flex-1 resize-none bg-transparent text-sm outline-none max-h-28"
                />
                <button
                  onClick={() => void send()}
                  disabled={streaming || !input.trim()}
                  aria-label={t('assistant.send')}
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
                  style={{ background: ACCENT }}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
