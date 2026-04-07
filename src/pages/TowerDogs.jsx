import { useState } from 'react'
import useDogsData from '../hooks/tower/useDogsData'
import { towerSectionLabel } from '../components/tower/tower-utils'

const FILTERS = ['All', 'Plateau', 'Laurier', '\u2605 Has forever note']

function DoorPill({ code }) {
  if (!code) return null
  return (
    <span
      style={{
        background: 'var(--tower-slate)',
        color: 'var(--tower-text-inverse)',
        fontSize: 'var(--tower-text-xs)',
        fontWeight: 'var(--tower-font-bold)',
        borderRadius: 5,
        padding: '2px 7px',
      }}
    >
      {code}
    </span>
  )
}

export default function TowerDogs() {
  const { dogs, loading, error } = useDogsData()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const q = search.toLowerCase()

  const filtered = dogs.filter((d) => {
    if (filter === 'Plateau' && d.sector !== 'Plateau') return false
    if (filter === 'Laurier' && d.sector !== 'Laurier') return false
    if (filter === '\u2605 Has forever note' && (!d.notes || !d.notes.trim())) return false
    if (q) {
      const hay = [d.dog_name, d.owner_first, d.owner_last, d.address]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const plateau = filtered.filter((d) => d.sector === 'Plateau')
  const laurier = filtered.filter((d) => d.sector === 'Laurier')
  const total = dogs.length
  const pCount = dogs.filter((d) => d.sector === 'Plateau').length
  const lCount = dogs.filter((d) => d.sector === 'Laurier').length

  const thStyle = {
    ...towerSectionLabel,
    fontSize: 'var(--tower-text-xs)',
    letterSpacing: '0.08em',
    padding: '10px 12px',
    textAlign: 'left',
    background: 'var(--tower-bg-surface-alt)',
    borderBottom: '1px solid var(--tower-border-default)',
  }

  const tdStyle = {
    padding: '8px 12px',
    fontSize: 'var(--tower-text-base)',
    color: 'var(--tower-text-secondary)',
    fontFamily: 'var(--tower-font)',
    borderBottom: '1px solid var(--tower-bg-surface-alt)',
    verticalAlign: 'middle',
  }

  function renderRows(rows) {
    return rows.map((d) => (
      <tr
        key={d.dog_name}
        style={{ cursor: 'default' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFB' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <td style={{ ...tdStyle, fontWeight: 'var(--tower-font-semibold)', color: 'var(--tower-purple)' }}>
          {d.notes && d.notes.trim() && (
            <span style={{ color: 'var(--tower-fuschia)', marginRight: 4 }}>{'\u2605'}</span>
          )}
          {d.dog_name}
        </td>
        <td style={tdStyle}>{d.breed || '\u2014'}</td>
        <td style={tdStyle}>{[d.owner_first, d.owner_last].filter(Boolean).join(' ') || '\u2014'}</td>
        <td style={tdStyle}>{d.address || '\u2014'}</td>
        <td style={tdStyle}><DoorPill code={d.door_code} /></td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {d.notes && d.notes.trim()
            ? <span style={{ color: 'var(--tower-fuschia)', fontWeight: 'var(--tower-font-bold)' }}>{'\u2605'}</span>
            : <span style={{ color: 'var(--tower-text-muted)' }}>{'\u2014'}</span>}
        </td>
      </tr>
    ))
  }

  return (
    <div className="px-6 py-6" style={{ fontFamily: 'var(--tower-font)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ height: 56 }}>
        <h1 style={{ fontSize: 'var(--tower-text-xl)', fontWeight: 'var(--tower-font-bold)', color: 'var(--tower-text-primary)', margin: 0 }}>
          Dogs
        </h1>
        <span style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>
          {total} dogs {'\u00b7'}{' '}
          <span style={{ color: 'var(--tower-plateau-blue)' }}>{pCount} Plateau</span>
          {' \u00b7 '}
          <span style={{ color: 'var(--tower-laurier-green)' }}>{lCount} Laurier</span>
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, owner, or address..."
        style={{
          width: '100%',
          border: '1px solid var(--tower-border-default)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 'var(--tower-text-md)',
          fontFamily: 'var(--tower-font)',
          outline: 'none',
          background: 'var(--tower-bg-surface)',
          color: 'var(--tower-text-primary)',
          marginBottom: 10,
        }}
      />

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--tower-purple)' : 'var(--tower-bg-surface-alt)',
              color: filter === f ? 'var(--tower-text-inverse)' : 'var(--tower-text-secondary)',
              fontSize: 'var(--tower-text-base)',
              fontWeight: 'var(--tower-font-semibold)',
              borderRadius: 20,
              padding: '4px 14px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--tower-font)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-text-muted)' }}>Loading&hellip;</p>
      ) : error ? (
        <p style={{ fontSize: 'var(--tower-text-md)', color: 'var(--tower-coral)' }}>{error}</p>
      ) : (
        <div style={{ background: 'var(--tower-bg-surface)', border: '1px solid var(--tower-border-default)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Breed</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Address</th>
                <th style={thStyle}>Door</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {/* Plateau section */}
              {plateau.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        background: 'var(--tower-plateau-blue-light)',
                        color: 'var(--tower-plateau-blue)',
                        fontSize: 'var(--tower-text-sm)',
                        fontWeight: 'var(--tower-font-bold)',
                        textTransform: 'uppercase',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--tower-border-default)',
                      }}
                    >
                      {'\ud83c\udfd4\ufe0f'} PLATEAU {'\u00b7'} {plateau.length} dogs
                    </td>
                  </tr>
                  {renderRows(plateau)}
                </>
              )}
              {/* Laurier section */}
              {laurier.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        background: 'var(--tower-laurier-green-light)',
                        color: 'var(--tower-laurier-green)',
                        fontSize: 'var(--tower-text-sm)',
                        fontWeight: 'var(--tower-font-bold)',
                        textTransform: 'uppercase',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--tower-border-default)',
                      }}
                    >
                      {'\ud83c\udf33'} LAURIER {'\u00b7'} {laurier.length} dogs
                    </td>
                  </tr>
                  {renderRows(laurier)}
                </>
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', padding: '32px 12px', color: 'var(--tower-text-muted)', fontStyle: 'italic' }}>
                    No dogs match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
