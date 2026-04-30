import { useState, useRef, useEffect } from 'react'
import { assertFreshOrThrow, StaleBundleError } from '../../../lib/freshBundle'
import BeastMessage from './BeastMessage'
import BeastConfirm from './BeastConfirm'

const TOWER_SYSTEM = `You are The Beast — Wiggle Dog Walks' internal AI assistant, speaking to Gen or Rod (admins) inside Tower Control.

You have read access to: dogs, walk_groups, walker_notes, owl_notes, mini_gen_drafts, profiles, acuity_name_map, dog_conflicts.

You help with:
- Answering questions about today's walks, dogs, schedules, and notes
- Suggesting actions: add owl notes, mark dogs not walking, flag bookings, draft messages
- Reviewing Mini Gen results and flags

HARD RULES:
- You NEVER execute an action without confirmation. You always suggest first.
- When your response implies ANY action (writing data, sending a message, adding a note), you MUST end with a confirmation block on its own line:
  CONFIRM: [plain English description of the exact action to take]
- Only include ONE CONFIRM line per response, for the primary action.
- If the user is just asking a question (no action needed), respond normally without CONFIRM.
- Be concise. Tower is a work tool, not a chat buddy.
- Use dog names, walker names, and sector names exactly as they appear in the database.
- When you don't know something, say so. Don't fabricate data.`

function parseConfirm(text) {
  const idx = text.indexOf('CONFIRM:')
  if (idx === -1) return { display: text.trim(), action: null }
  const display = text.slice(0, idx).trim()
  const action = text.slice(idx + 'CONFIRM:'.length).trim()
  return { display, action }
}

export default function BeastSection() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirms, setConfirms] = useState({}) // messageIndex → action string
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }

    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = next.map((m) => ({
        role: m.role === 'beast' ? 'assistant' : m.role,
        content: m.content,
      }))

      const res = await fetch('/api/beast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: TOWER_SYSTEM,
          messages: apiMessages,
        }),
      })

      if (!res.ok) throw new Error('Beast API error')
      const data = await res.json()
      const raw = data.content?.[0]?.text || 'No response.'

      const { display, action } = parseConfirm(raw)
      const beastMsg = { role: 'beast', content: display }
      const updated = [...next, beastMsg]
      setMessages(updated)

      if (action) {
        setConfirms((prev) => ({ ...prev, [updated.length - 1]: action }))
      }
    } catch {
      setMessages([...next, { role: 'beast', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function dismissConfirm(idx) {
    setConfirms((prev) => {
      const copy = { ...prev }
      delete copy[idx]
      return copy
    })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className="mt-8"
      style={{
        border: '1px solid var(--tower-border-default)',
        borderRadius: 10,
        overflow: 'hidden',
        fontFamily: 'var(--tower-font)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          height: 48,
          background: 'linear-gradient(135deg, #C45D1A, #E8762B)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
          {'\ud83e\udda7'} The Beast
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 20,
            padding: '2px 10px',
          }}
        >
          Confirms before acting
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="px-4 py-3"
        style={{
          background: 'var(--tower-bg-surface)',
          minHeight: 200,
          maxHeight: 400,
          overflowY: 'auto',
        }}
      >
        {messages.length === 0 && !loading && (
          <p
            style={{
              fontSize: 'var(--tower-text-md)',
              color: 'var(--tower-text-muted)',
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '60px 0',
            }}
          >
            Ask the Beast anything about today&rsquo;s walks, dogs, or schedules.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <BeastMessage role={msg.role} content={msg.content} />
            {confirms[i] && (
              <div className="flex mb-3" style={{ justifyContent: 'flex-start' }}>
                <div style={{ maxWidth: '85%' }}>
                  <BeastConfirm
                    action={confirms[i]}
                    onConfirm={() => {}}
                    onCancel={() => dismissConfirm(i)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex mb-3" style={{ justifyContent: 'flex-start' }}>
            <div
              style={{
                background: 'var(--tower-orange-light)',
                border: '1px solid var(--tower-orange)',
                borderRadius: '10px 10px 10px 2px',
                padding: '8px 12px',
                fontSize: 'var(--tower-text-base)',
                color: 'var(--tower-text-muted)',
              }}
            >
              Thinking&hellip;
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-4 py-3"
        style={{
          background: 'var(--tower-bg-surface-alt)',
          borderTop: '1px solid var(--tower-border-default)',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Beast..."
          disabled={loading}
          rows={3}
          style={{
            width: '100%',
            border: '2px solid var(--tower-border-default)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 'var(--tower-text-md)',
            fontFamily: 'var(--tower-font)',
            resize: 'none',
            outline: 'none',
            background: 'var(--tower-bg-surface)',
            color: 'var(--tower-text-primary)',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--tower-orange)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--tower-border-default)' }}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              background: 'var(--tower-orange)',
              color: 'var(--tower-text-inverse)',
              fontSize: 'var(--tower-text-base)',
              fontWeight: 'var(--tower-font-bold)',
              borderRadius: 8,
              padding: '8px 16px',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
