import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import BottomTabs from '../components/BottomTabs'
import LoadingDog from '../components/LoadingDog'
import DogProfileDrawer from '../components/DogProfileDrawer'

const SECTOR_OPTIONS = ['All', 'Plateau', 'Laurier']

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
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent placeholder:text-gray-400"
          />
        </div>

        {/* Sector filter */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200">
          {SECTOR_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                sector === s
                  ? 'bg-[#E8634A] text-white shadow-sm'
                  : 'text-gray-500 active:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <LoadingDog text="Fetching good boys & girls..." />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-base font-semibold text-gray-500">No dogs found</p>
            <p className="text-sm text-gray-400">
              {search ? `No matches for "${search}"` : 'No dogs in this sector yet'}
            </p>
          </div>
        )}

        {/* Dog cards */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map((dog) => (
              <button
                key={dog.id}
                onClick={() => setSelectedDog(dog)}
                className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform text-left"
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
                  <p className="text-sm font-bold text-[#1A1A1A] truncate">{dog.dog_name}</p>
                  {dog.breed && (
                    <p className="text-xs text-gray-400 truncate">{dog.breed}</p>
                  )}
                </div>

                {/* Sector badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  dog.sector === 'Plateau'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {dog.sector}
                </span>
              </button>
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
        />
      )}

      <BottomTabs />
    </div>
  )
}
