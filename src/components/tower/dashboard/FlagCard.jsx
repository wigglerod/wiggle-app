import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { assertFreshOrThrow, StaleBundleError } from '../../../lib/freshBundle'
import { toast } from 'sonner'

function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

/** Turn a raw flag object from mini_gen_drafts.flags into plain language + Tower-cool styling. */
function formatFlag(flag) {
  if (flag.type === 'conflict') {
    return {
      message: `${flag.dog1} and ${flag.dog2} are both booked in the same sector`,
      instruction: 'Resolve in Acuity — rebook one dog on a different day, then Run Mini Gen again.',
      border: 'var(--tower-coral)',
      bg: 'var(--tower-coral-light)',
    }
  }
  if (flag.type === 'vacation') {
    return {
      message: `${flag.dogName} is booked but shouldn't be walking`,
      instruction: null,
      border: 'var(--tower-amber)',
      bg: 'var(--tower-amber-light)',
    }
  }
  if (flag.type === 'unresolved') {
    return {
      message: `"${flag.ownerName}" couldn't be matched to a dog`,
      instruction: null,
      border: 'var(--tower-slate)',
      bg: 'var(--tower-bg-surface-alt)',
    }
  }
  if (flag.type === 'capacity') {
    return {
      message: `${flag.count} dogs — ${flag.level === 'critical' ? 'way over' : 'near'} capacity`,
      instruction: 'Consider moving some dogs to balance the load',
      border: 'var(--tower-purple)',
      bg: 'var(--tower-purple-light)',
    }
  }
  return {
    message: flag.reason || JSON.stringify(flag),
    instruction: 'Review this flag manually',
    border: 'var(--tower-slate)',
    bg: 'var(--tower-bg-surface-alt)',
  }
}

/* ── Resolver: map an unmatched owner name to a dog (acuity_name_map) ── */
function UnresolvedFixForm({ flag, onResolved }) {
  const [query, setQuery] = useState('')
  const [dogs, setDogs] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mapped, setMapped] = useState(false)

  useEffect(() => {
    supabase.from('dogs').select('dog_name').order('dog_name').then(({ data }) => {
      if (data) setDogs(data.map((d) => d.dog_name))
    })
  }, [])

  const filtered = query.length >= 1
    ? dogs.filter((n) => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  async function handleSave() {
    if (!query.trim()) return
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setSaving(true)
    try {
      const res = await fetch('/api/tower-add-name-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acuity_name: flag.ownerName, dog_name: query.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setMapped(true)
      toast.success(`Mapped "${flag.ownerName}" → ${query.trim()}`)
      onResolved?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (mapped) {
    return (
      <p
        className="mt-2"
        style={{ fontSize: 'var(--tower-text-sm)', fontWeight: 'var(--tower-font-medium)', color: 'var(--tower-sage)' }}
      >
        ✓ Mapped — resolves on the next Mini Gen run
      </p>
    )
  }

  return (
    <div className="mt-2 relative">
      <label style={{ fontSize: 'var(--tower-text-xs)', fontWeight: 'var(--tower-font-medium)', color: 'var(--tower-text-secondary)' }}>
        Which dog is this?
      </label>
      <div className="flex gap-2 mt-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDrop(true) }}
            onFocus={() => query.length >= 1 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Search dog name…"
            className="w-full px-2 py-1.5 rounded-md"
            style={{
              fontSize: 'var(--tower-text-base)',
              border: '1px solid var(--tower-border-default)',
              background: 'var(--tower-bg-surface)',
              color: 'var(--tower-text-primary)',
              fontFamily: 'var(--tower-font)',
            }}
          />
          {showDrop && filtered.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-md shadow-md z-10 overflow-hidden"
              style={{ background: 'var(--tower-bg-surface)', border: '1px solid var(--tower-border-default)' }}
            >
              {filtered.map((name) => (
                <button
                  key={name}
                  className="block w-full text-left px-3 py-2 hover:bg-[var(--tower-bg-surface-hover)]"
                  style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-primary)', fontFamily: 'var(--tower-font)' }}
                  onMouseDown={() => { setQuery(name); setShowDrop(false) }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !query.trim()}
          className="px-3 py-1.5 rounded-md disabled:opacity-50 whitespace-nowrap"
          style={{
            fontSize: 'var(--tower-text-sm)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-text-inverse)',
            background: 'var(--tower-sage)',
          }}
        >
          {saving ? '…' : 'Save to name map'}
        </button>
      </div>
    </div>
  )
}

/* ── Resolver: pull a vacationing dog off this day (mini_gen_drafts) ── */
function VacationRemoveBtn({ flag, onResolved }) {
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState(false)

  async function handleRemove() {
    try { await assertFreshOrThrow() } catch (e) { if (e instanceof StaleBundleError) return; throw e }
    setBusy(true)
    try {
      const { data: current, error: readErr } = await supabase
        .from('mini_gen_drafts')
        .select('dog_names, dog_uuids, flags')
        .eq('id', flag.draftId)
        .single()
      if (readErr) throw readErr

      const idx = current.dog_names.indexOf(flag.dogName)
      const newNames = current.dog_names.filter((n) => n !== flag.dogName)
      const newUuids = idx >= 0
        ? current.dog_uuids.filter((_, i) => i !== idx)
        : current.dog_uuids
      const newFlags = (current.flags || []).filter(
        (f) => !(f.type === 'vacation' && f.dogName === flag.dogName),
      )

      const { error: updateErr } = await supabase
        .from('mini_gen_drafts')
        .update({ dog_names: newNames, dog_uuids: newUuids, flags: newFlags })
        .eq('id', flag.draftId)
      if (updateErr) throw updateErr

      setRemoved(true)
      toast.success(`Removed ${flag.dogName} from this day`)
      onResolved?.()
    } catch (e) {
      toast.error(e.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  if (removed) {
    return (
      <p
        className="mt-2"
        style={{ fontSize: 'var(--tower-text-sm)', fontWeight: 'var(--tower-font-medium)', color: 'var(--tower-sage)' }}
      >
        ✓ Removed
      </p>
    )
  }

  return (
    <button
      onClick={handleRemove}
      disabled={busy}
      className="mt-2 px-3 py-1.5 rounded-md disabled:opacity-50"
      style={{
        fontSize: 'var(--tower-text-sm)',
        fontWeight: 'var(--tower-font-bold)',
        color: 'var(--tower-text-inverse)',
        background: 'var(--tower-amber)',
      }}
    >
      {busy ? '…' : 'Remove from this day'}
    </button>
  )
}

/**
 * Dashboard flag card — reads from the canonical source (mini_gen_drafts.flags).
 * Display for everyone; resolver affordances are admin-only (parity with the
 * former /tower/mini-gen page, which required role === 'admin').
 */
export default function FlagCard({ flag, onResolved }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { message, instruction, border, bg } = formatFlag(flag)

  return (
    <div
      className="p-3"
      style={{
        background: bg,
        borderLeft: `4px solid ${border}`,
        borderRadius: '0 10px 10px 0',
        fontFamily: 'var(--tower-font)',
      }}
    >
      <div className="flex items-center justify-between mb-1 gap-3">
        <span
          style={{
            fontSize: 'var(--tower-text-md)',
            fontWeight: 'var(--tower-font-bold)',
            color: 'var(--tower-text-primary)',
          }}
        >
          {message}
        </span>
        <span style={{ fontSize: 'var(--tower-text-sm)', color: 'var(--tower-text-muted)', whiteSpace: 'nowrap' }}>
          {fmtDate(flag.walk_date)}
        </span>
      </div>

      {instruction && (
        <p style={{ fontSize: 'var(--tower-text-base)', color: 'var(--tower-text-secondary)', margin: 0 }}>
          {instruction}
        </p>
      )}

      {isAdmin && flag.type === 'unresolved' && (
        <UnresolvedFixForm flag={flag} onResolved={onResolved} />
      )}
      {isAdmin && flag.type === 'vacation' && (
        <VacationRemoveBtn flag={flag} onResolved={onResolved} />
      )}
    </div>
  )
}
