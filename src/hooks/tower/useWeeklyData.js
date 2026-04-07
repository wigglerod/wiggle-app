import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMonday)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { monday: fmt(mon), friday: fmt(fri) }
}

function fmtLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function buildDays(monday, drafts) {
  const days = []
  const mon = new Date(monday + 'T12:00:00')

  for (let i = 0; i < 5; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const date = d.toISOString().slice(0, 10)

    const plateau = drafts.find((r) => r.walk_date === date && r.sector === 'Plateau')
    const laurier = drafts.find((r) => r.walk_date === date && r.sector === 'Laurier')

    days.push({
      date,
      label: fmtLabel(date),
      plateau: plateau
        ? { dog_names: plateau.dog_names || [], status: plateau.status }
        : null,
      laurier: laurier
        ? { dog_names: laurier.dog_names || [], status: laurier.status }
        : null,
    })
  }

  return days
}

export default function useWeeklyData() {
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { monday, friday } = getWeekRange()

  const weekLabel = `${fmtLabel(monday).replace(/^\w+,?\s*/, '')} – ${fmtLabel(friday).replace(/^\w+,?\s*/, '')}, ${new Date(friday + 'T12:00:00').getFullYear()}`

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('mini_gen_drafts')
        .select('walk_date, sector, dog_names, status')
        .gte('walk_date', monday)
        .lte('walk_date', friday)
        .order('walk_date')
        .order('sector')

      if (err) throw err
      setDays(buildDays(monday, data || []))
    } catch (e) {
      setError(e.message || 'Failed to load weekly data')
    } finally {
      setLoading(false)
    }
  }, [monday, friday])

  useEffect(() => { fetch_() }, [fetch_])

  return { days, weekLabel, monday, loading, error, refetch: fetch_ }
}
