import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WORK_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

export default function WeeklyView({ sector, today, onSelectDay }) {
  const [weekData, setWeekData] = useState({})
  const [walkers, setWalkers] = useState([])

  // Compute the 7 days of the current week (Sun → Sat)
  const weekDays = useMemo(() => {
    const now = new Date(today + 'T12:00:00')
    const dayOfWeek = now.getDay()
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dayOfWeek)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      const dateStr = d.toLocaleDateString('en-CA')
      return {
        date: dateStr,
        dayName: DAY_NAMES[i],
        dayNum: d.getDate(),
        isToday: dateStr === today,
        isWorkDay: WORK_DAYS.has(DAY_NAMES[i]),
      }
    })
  }, [today])

  // Load walk_groups for the entire week + walker profiles
  useEffect(() => {
    async function load() {
      const dates = weekDays.map(d => d.date)
      const [groupsRes, walkersRes] = await Promise.all([
        supabase
          .from('walk_groups')
          .select('walk_date, group_num, dog_ids, walker_ids, group_name')
          .in('walk_date', dates)
          .eq('sector', sector === 'both' ? 'Plateau' : sector),
        supabase
          .from('profiles')
          .select('id, full_name, sector, schedule, role')
          .in('role', ['admin', 'senior_walker', 'junior_walker'])
          .order('full_name'),
      ])

      const dataMap = {}
      if (groupsRes.data) {
        for (const row of groupsRes.data) {
          if (!dataMap[row.walk_date]) dataMap[row.walk_date] = { groups: 0, dogs: 0, walkerIds: new Set() }
          const entry = dataMap[row.walk_date]
          entry.groups++
          entry.dogs += (row.dog_ids || []).length
          for (const wId of (row.walker_ids || [])) entry.walkerIds.add(wId)
        }
      }
      setWeekData(dataMap)

      const filtered = (walkersRes.data || []).filter(w => {
        if (sector === 'both') return true
        return w.sector === sector || w.sector === 'both'
      })
      setWalkers(filtered)
    }
    load()
  }, [weekDays, sector])

  const walkerMap = useMemo(() => {
    const m = {}
    for (const w of walkers) m[w.id] = w.full_name?.split(' ')[0]
    return m
  }, [walkers])

  function workersForDay(dayName) {
    return walkers
      .filter(w => !w.schedule || w.schedule.includes(dayName))
      .map(w => w.full_name?.split(' ')[0])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {weekDays.map(day => {
        const data = weekData[day.date]
        const isOff = !day.isWorkDay
        const dayWorkers = day.isWorkDay ? workersForDay(day.dayName) : []
        const walkerNames = data
          ? [...data.walkerIds].map(id => walkerMap[id]).filter(Boolean)
          : dayWorkers
        const dogCount = data?.dogs || 0

        return (
          <button
            key={day.date}
            onClick={() => !isOff && onSelectDay(day.date)}
            disabled={isOff}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 12, padding: '10px 12px',
              border: day.isToday ? '2px solid #E8634A' : '0.5px solid #e8e5e0',
              opacity: isOff ? 0.5 : 1,
              cursor: isOff ? 'default' : 'pointer',
              textAlign: 'left', minHeight: 52,
            }}
          >
            {/* Left accent bar */}
            <div style={{
              width: 4, height: 32, borderRadius: 2, flexShrink: 0,
              background: isOff ? 'transparent' : day.isToday ? '#E8634A' : '#d1d5db',
            }} />

            {/* Day info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                  {day.dayName} {day.dayNum}
                </span>
                {day.isToday && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: '#E8634A', color: '#fff', fontWeight: 600 }}>
                    today
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isOff
                  ? 'No walks'
                  : walkerNames.length > 0
                    ? walkerNames.join(', ') + (data?.groups ? ` \u00b7 ${data.groups} group${data.groups > 1 ? 's' : ''}` : '')
                    : 'No groups yet'
                }
              </p>
            </div>

            {/* Dog count circle */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: isOff ? '#f0ece8' : dogCount > 0 ? '#E8634A' : '#f0ece8',
              color: isOff ? '#ccc' : dogCount > 0 ? '#fff' : '#aaa',
            }}>
              {isOff ? '\u2014' : dogCount || '\u2014'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
