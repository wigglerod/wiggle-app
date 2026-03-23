import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import BottomTabs from '../components/BottomTabs'
import LoadingDog from '../components/LoadingDog'
import DogProfileDrawer from '../components/DogProfileDrawer'
import { getCachedDogs, setCachedDogs } from '../lib/useOffline'
import { useAuth } from '../context/AuthContext'

// ── Friend check component for Dogs page ─────────────────────────────
function FriendCheckSection({ allDogs }) {
  const [dog1, setDog1] = useState(null)
  const [dog2, setDog2] = useState(null)
  const [search1, setSearch1] = useState('')
  const [search2, setSearch2] = useState('')
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [showExtra, setShowExtra] = useState(false)

  const options1 = useMemo(() => {
    if (!search1) return []
    const q = search1.toLowerCase()
    return allDogs
      .filter(d => d.dog_name.toLowerCase().includes(q) && d.id !== dog2?.id)
      .sort((a, b) => {
        const aL = a.dog_name.toLowerCase()
        const bL = b.dog_name.toLowerCase()
        return (aL.startsWith(q) ? 0 : 1) - (bL.startsWith(q) ? 0 : 1)
      })
      .slice(0, 6)
  }, [search1, allDogs, dog2])

  const options2 = useMemo(() => {
    if (!search2) return []
    const q = search2.toLowerCase()
    return allDogs
      .filter(d => d.dog_name.toLowerCase().includes(q) && d.id !== dog1?.id)
      .sort((a, b) => {
        const aL = a.dog_name.toLowerCase()
        const bL = b.dog_name.toLowerCase()
        return (aL.startsWith(q) ? 0 : 1) - (bL.startsWith(q) ? 0 : 1)
      })
      .slice(0, 6)
  }, [search2, allDogs, dog1])

  function selectDog1(d) { setDog1(d); setSearch1(d.dog_name); setResult(null) }
  function selectDog2(d) { setDog2(d); setSearch2(d.dog_name); setResult(null) }

  async function handleCheck() {
    if (!dog1 || !dog2) return
    setSearching(true)
    setResult(null)
    setShowExtra(false)

    const [{ data: logs1 }, { data: logs2 }] = await Promise.all([
      supabase.from('walk_logs').select('walk_date').eq('dog_id', dog1.id).order('walk_date', { ascending: false }),
      supabase.from('walk_logs').select('walk_date').eq('dog_id', dog2.id).order('walk_date', { ascending: false }),
    ])

    const dates1 = new Set((logs1 || []).map(l => l.walk_date))
    const dates2 = new Set((logs2 || []).map(l => l.walk_date))
    const sharedDates = [...dates1].filter(d => dates2.has(d)).sort().reverse()

    setResult({
      dog1Name: dog1.dog_name,
      dog2Name: dog2.dog_name,
      count: sharedDates.length,
      dates: sharedDates,
      first: sharedDates.length > 0 ? sharedDates[sharedDates.length - 1] : null,
      last: sharedDates.length > 0 ? sharedDates[0] : null,
    })
    setSearching(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
      <p className="text-xs font-semibold text-[#E8634A] uppercase tracking-wide mb-2">Check for Friends</p>
      <div className="flex gap-2 mb-2">
        {/* Dog 1 input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search1}
            onChange={(e) => { setSearch1(e.target.value); if (dog1 && e.target.value !== dog1.dog_name) setDog1(null) }}
            placeholder="@dog1"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
          />
          {search1 && !dog1 && options1.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-40 overflow-y-auto">
              {options1.map(d => (
                <button
                  key={d.id}
                  onClick={() => selectDog1(d)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#FFF4F1] transition-colors"
                >
                  <span className="text-gray-400">🐕</span>
                  <span className="text-gray-700 font-medium">{d.dog_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Dog 2 input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search2}
            onChange={(e) => { setSearch2(e.target.value); if (dog2 && e.target.value !== dog2.dog_name) setDog2(null) }}
            placeholder="@dog2"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]"
          />
          {search2 && !dog2 && options2.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-40 overflow-y-auto">
              {options2.map(d => (
                <button
                  key={d.id}
                  onClick={() => selectDog2(d)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#FFF4F1] transition-colors"
                >
                  <span className="text-gray-400">🐕</span>
                  <span className="text-gray-700 font-medium">{d.dog_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={handleCheck}
        disabled={!dog1 || !dog2 || searching}
        className="w-full py-2.5 rounded-full bg-[#E8634A] text-white text-sm font-bold disabled:opacity-40 active:bg-[#d4552d] transition-all min-h-[44px]"
      >
        {searching ? 'Checking...' : '🐾 Have they walked together?'}
      </button>

      {result && (
        <div className="bg-gray-50 rounded-xl p-3 mt-2">
          <p className="text-sm font-semibold text-gray-800">
            {result.dog1Name} and {result.dog2Name} walked together{' '}
            <span className="text-[#E8634A]">{result.count} time{result.count !== 1 ? 's' : ''}</span>
          </p>
          {result.count > 0 && (
            <>
              <button
                onClick={() => setShowExtra(!showExtra)}
                className="text-xs text-gray-400 mt-1 active:text-gray-600"
              >
                Extra info {showExtra ? '▴' : '▾'}
              </button>
              {showExtra && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>First: {new Date(result.first).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p>Last: {new Date(result.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.dates.slice(0, 10).map(d => (
                      <span key={d} className="bg-gray-100 px-2 py-0.5 rounded-full">
                        {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ))}
                    {result.dates.length > 10 && <span className="text-gray-400">+{result.dates.length - 10} more</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const SECTOR_OPTIONS = ['All', 'Plateau', 'Laurier']

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 skeleton-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200" />
        <div className="flex-1">
          <div className="h-4 w-28 bg-gray-200 rounded-lg mb-2" />
          <div className="h-3 w-20 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </div>
    </div>
  )
}

export default function DogsPage() {
  const { permissions, sector: userSector } = useAuth()
  const [dogs, setDogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('All')
  const [selectedDog, setSelectedDog] = useState(null)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  const PULL_THRESHOLD = 64
  const PULL_MAX = 90

  async function fetchDogs() {
    setLoading(true)
    let query = supabase.from('dogs').select('*').order('dog_name')
    if (!permissions.canSeeAllSectors && userSector && userSector !== 'both') {
      query = query.eq('sector', userSector)
    }
    const { data, error } = await query
    if (error) {
      toast.error('Failed to load dogs')
    } else {
      setDogs(data || [])
      if (data?.length > 0) setCachedDogs(data)
    }
    setLoading(false)
    setRefreshing(false)
  }

  // Load cached dogs instantly
  useEffect(() => {
    const cached = getCachedDogs()
    if (cached) {
      setDogs(cached)
      setLoading(false)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- fetch from external DB on mount */
  useEffect(() => { fetchDogs() }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleTouchStart(e) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }

  function handleTouchMove(e) {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setPullY(Math.min(delta * 0.45, PULL_MAX))
    } else {
      isPulling.current = false
      setPullY(0)
    }
  }

  function handleTouchEnd() {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullY >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      fetchDogs()
    }
    setPullY(0)
    touchStartY.current = 0
  }

  const filtered = useMemo(() => dogs.filter((d) => {
    if (sector !== 'All' && d.sector !== sector) return false
    if (search && !d.dog_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [dogs, sector, search])

  return (
    <div
      className="min-h-screen bg-[#FFF4F1] pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Header />

      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? 88 : pullY }}
      >
        {(pullY > 8 || refreshing) && (
          <LoadingDog text={refreshing ? 'Wiggling...' : pullY >= PULL_THRESHOLD ? 'Release!' : 'Pull to refresh...'} />
        )}
      </div>

      <main className="px-4 pt-3 pb-4 max-w-lg mx-auto">
        {/* Search bar */}
        <div className="relative mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Search dogs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search dogs"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent placeholder:text-gray-400"
          />
        </div>

        {/* Check for friends */}
        <FriendCheckSection allDogs={dogs} />

        {/* Sector filter with animated pill — admins only */}
        {permissions.canSeeAllSectors && (
          <div className="relative flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200">
            {SECTOR_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className="relative flex-1 py-2 rounded-lg text-sm font-semibold z-[1]"
              >
                {sector === s && (
                  <motion.div
                    layoutId="sector-pill"
                    className="absolute inset-0 bg-[#E8634A] rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className={`relative z-[2] ${sector === s ? 'text-white' : 'text-gray-500'}`}>
                  {s}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Skeleton loading */}
        {loading && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <LoadingDog text={search ? 'No explorers found!' : 'No dogs in this sector yet'} />
          </div>
        )}

        {/* Dog cards with staggered fade-in */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map((dog, i) => (
              <motion.button
                key={dog.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => setSelectedDog(dog)}
                className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform text-left min-h-[56px]"
              >
                {/* Photo or emoji */}
                <div className="w-11 h-11 rounded-xl bg-[#FFF4F1] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {dog.photo_url ? (
                    <img src={dog.photo_url} alt={dog.dog_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">🐶</span>
                  )}
                </div>

                {/* Level dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    dog.level === 3 ? 'bg-red-500' : dog.level === 2 ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-[#1A1A1A] truncate">{dog.dog_name}</p>
                  {dog.breed && (
                    <p className="text-[14px] text-[#888] truncate">{dog.breed}</p>
                  )}
                </div>

                {/* Sector badge — only when viewing all sectors */}
                {permissions.canSeeAllSectors && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    dog.sector === 'Plateau'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-[#FDEBE7] text-[#E8634A]'
                  }`}>
                    {dog.sector}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Count */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            {filtered.length} dog{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </main>

      {/* Dog profile drawer */}
      {selectedDog && (
        <DogProfileDrawer
          dog={selectedDog}
          onClose={() => setSelectedDog(null)}
          onDogUpdated={(updated) => {
            setSelectedDog(updated)
            setDogs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }}
        />
      )}

      <BottomTabs />
    </div>
  )
}
