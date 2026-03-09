import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import BottomTabs from '../components/BottomTabs'
import LoadingDog from '../components/LoadingDog'
import DogProfileDrawer from '../components/DogProfileDrawer'

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
  const [dogs, setDogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('All')
  const [selectedDog, setSelectedDog] = useState(null)

  useEffect(() => {
    fetchDogs()
  }, [])

  async function fetchDogs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('dogs')
      .select('*')
      .order('dog_name')
    if (!error) setDogs(data || [])
    setLoading(false)
  }

  const filtered = dogs.filter((d) => {
    if (sector !== 'All' && d.sector !== sector) return false
    if (search && !d.dog_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#FFF4F1] pb-20">
      <Header />

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
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent placeholder:text-gray-400"
          />
        </div>

        {/* Sector filter with animated pill */}
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-[#1A1A1A] truncate">{dog.dog_name}</p>
                  {dog.breed && (
                    <p className="text-[14px] text-[#888] truncate">{dog.breed}</p>
                  )}
                </div>

                {/* Sector badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  dog.sector === 'Plateau'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-[#FDEBE7] text-[#E8634A]'
                }`}>
                  {dog.sector}
                </span>
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
