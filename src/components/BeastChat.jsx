import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const BEAST_ORANGE = '#e8762b'

const SYSTEM_PROMPT = `You are The Beast, the AI assistant for Wiggle Dog Walks in Montréal. You help Rodrigo and Gen manage 95 dogs across 2 sectors (Plateau and Laurier) with 7 walkers.

You know:
- The business runs on Acuity Scheduling, Supabase, and a React PWA
- Sectors: Plateau (~56 dogs) and Laurier (~39 dogs)
- Walkers: Megan, Solene, Chloe (Plateau), Amanda, Belen, Amelie, Maeva (Laurier)
- Admin: Rodrigo (owner), Gen (operations)
- Dogs have levels (1=Chill, 2=Medium, 3=Spicy), BFFs, conflicts, and special notes
- Walker notes track walk observations (pulled hard, reactive, great walk, etc.)

Be concise, practical, and warm. Use dog names when possible. You're part of the Wiggle family.`

const QUICK_ACTIONS = [
  { label: 'Today\'s status', emoji: '📊', prompt: 'Give me a quick status of today — how many dogs, which walkers are on, any issues?' },
  { label: 'Walker notes', emoji: '🐕', prompt: 'Summarize today\'s walker notes. Any patterns or concerns?' },
  { label: 'Any issues?', emoji: '⚠️', prompt: 'Flag anything concerning — dogs with repeated issues, missing info, conflicts, or scheduling gaps.' },
  { label: 'Tomorrow prep', emoji: '📋', prompt: 'What should we prepare for tomorrow? Any dogs with alt addresses, walker schedule gaps, or notes to follow up on?' },
]

async function fetchContext() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[new Date().getDay()]

  const [dogCounts, walkers, notes, owlNotes, altAddrs] = await Promise.all([
    supabase.from('dogs').select('sector', { count: 'exact', head: false }),
    supabase.from('profiles').select('full_name, sector, schedule, role').in('role', ['senior_walker']).order('full_name'),
    supabase.from('walker_notes').select('dog_name, tags, message, walker_name, created_at').eq('walk_date', today).order('created_at', { ascending: false }).limit(10),
    supabase.from('owl_notes').select('note_text, target_dog_name, target_sector').gte('expires_at', new Date().toISOString()).limit(5),
    supabase.from('dog_alt_addresses').select('dog_name, address, day_of_week').eq('day_of_week', dayName.toLowerCase()).limit(10),
  ])

  const plateauCount = (dogCounts.data || []).filter(d => d.sector === 'Plateau').length
  const laurierCount = (dogCounts.data || []).filter(d => d.sector === 'Laurier').length

  const todayDay = dayName.slice(0, 3)
  const workingWalkers = (walkers.data || []).filter(w => !w.schedule || w.schedule.includes(todayDay))

  const notesText = (notes.data || []).map(n => {
    const tags = n.tags ? n.tags.join(', ') : ''
    const msg = n.message || ''
    const time = new Date(n.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${n.dog_name} — ${[tags, msg].filter(Boolean).join('; ')} (${n.walker_name}, ${time})`
  }).join('\n') || 'none'

  const owlText = (owlNotes.data || []).map(n =>
    `${n.target_dog_name || n.target_sector || 'general'}: ${n.note_text}`
  ).join('\n') || 'none'

  const altText = (altAddrs.data || []).map(a => `${a.dog_name}: ${a.address}`).join('\n') || 'none'

  return `[CONTEXT]
Date: ${dayName} ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Plateau dogs: ${plateauCount}, Laurier dogs: ${laurierCount}
Today's walkers: ${workingWalkers.map(w => `${w.full_name} (${w.sector})`).join(', ') || 'none found'}
Recent walker notes:\n${notesText}
Active owl notes:\n${owlText}
Alt addresses today:\n${altText}
[/CONTEXT]`
}

export default function BeastChat() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function sendMessage(text) {
    if (!text.trim() || !apiKey || loading) return

    const userMsg = { role: 'user', content: text.trim(), ts: Date.now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const context = await fetchContext()

      // Build conversation: last 10 messages + context prefix on latest user message
      const trimmed = next.slice(-10)
      const apiMessages = trimmed.map((m, i) => ({
        role: m.role,
        content: i === trimmed.length - 1 && m.role === 'user'
          ? `${context}\n\nUser question: ${m.content}`
          : m.content,
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      const data = await res.json()
      const reply = data.content?.[0]?.text || 'No response'
      setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: Date.now() }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, ts: Date.now() }])
    }

    setLoading(false)
  }

  function clearChat() {
    setMessages([])
  }

  // No API key state
  if (!apiKey) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🔥</span>
          <h2 className="text-lg font-bold" style={{ color: BEAST_ORANGE }}>The Beast</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Beast needs an API key</p>
          <p>Add <code className="bg-amber-100 px-1 rounded text-xs">VITE_ANTHROPIC_API_KEY</code> to your <code className="bg-amber-100 px-1 rounded text-xs">.env.local</code> file and restart the dev server.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: BEAST_ORANGE }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <h2 className="text-white font-bold text-sm">The Beast</h2>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-white/60 active:text-white text-xs">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="p-4 flex flex-col gap-3 max-h-[400px] overflow-y-auto min-h-[120px]">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-gray-400 text-center py-6">Ask The Beast anything about Wiggle</p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-gray-100 text-gray-800'
                : 'text-white'
            }`} style={msg.role === 'assistant' ? { background: '#1A1A18' } : undefined}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(msg.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm text-white" style={{ background: '#1A1A18' }}>
              <span className="inline-flex gap-1">
                <span className="animate-pulse">Beast is thinking</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>.</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
        {QUICK_ACTIONS.map(({ label, emoji, prompt }) => (
          <button
            key={label}
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-600 font-medium active:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-1">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask The Beast..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-60"
            style={{ '--tw-ring-color': BEAST_ORANGE }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 active:opacity-80"
            style={{ background: BEAST_ORANGE }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
