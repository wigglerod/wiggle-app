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
    const dayOfWeek = now.getDay() // 0=Sun
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
          .in('role', ['admin', 'senior_walker'])
          .order('full_name'),
      ])

      // Build per-date data
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

      // Filter walkers by sector
      const filtered = (walkersRes.data || []).filter(w => {
        if (sector === 'both') return true
        return w.sector === sector || w.sector === 'both'
      })
      setWalkers(filtered)
    }
    load()
  }, [weekDays, sector])

  // Walker name lookup
  const walkerMap = useMemo(() => {
    const m = {}
    for (const w of walkers) m[w.id] = w.full_name?.split(' ')[0]
    return m
  }, [walkers])

  // Who works each day
  function workersForDay(dayName) {
    return walkers
      .filter(w => !w.schedule || w.schedule.includes(dayName))
      .map(w => w.full_name?.split(' ')[0])
  }

  return (
    <div className="flex flex-col gap-2">
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
            className={`flex items-center gap-3 rounded-[12px] px-3 py-3 text-left transition-all min-h-[56px] ${
              isOff
                ? 'bg-gray-50 opacity-35'
                : day.isToday
                  ? 'bg-white border-2 border-[#E8634A] shadow-sm'
                  : 'bg-white border border-gray-200/80 active:bg-gray-50'
            }`}
          >
            {/* Left accent bar */}
            <div
              className="w-[3px] h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: isOff ? 'transparent' : day.isToday ? '#E8634A' : '#d1d5db' }}
            />

            {/* Day info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-gray-700">
                  {day.dayName} {day.dayNum}
                </span>
                {day.isToday && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E8634A] text-white font-semibold">
                    today
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                {isOff
                  ? 'No walks'
                  : walkerNames.length > 0
                    ? walkerNames.join(', ') + (data?.groups ? ` \u00b7 ${data.groups} group${data.groups > 1 ? 's' : ''}` : '')
                    : 'No groups yet'
                }
              </p>
            </div>

            {/* Dog count circle */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
              isOff
                ? 'bg-gray-100 text-gray-300'
                : dogCount > 0
                  ? 'bg-[#E8634A]/10 text-[#E8634A]'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              {isOff ? '\u2014' : dogCount || '\u2014'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
