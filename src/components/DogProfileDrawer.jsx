import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

function mapsUrl(address) {
  if (!address) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export default function DogProfileDrawer({ dog, onClose }) {
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setDoorRevealed(false)
    setImgError(false)
  }, [dog])

  // Trap body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!dog) return null

  const photoUrl = dog.photo_url && !imgError ? dog.photo_url : null
  const directionsUrl = mapsUrl(dog.address)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-up sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-10 pt-2">

          {/* Header: photo + name + badges */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center flex-shrink-0 shadow-sm">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={dog.dog_name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-4xl">🐶</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight">{dog.dog_name}</h2>
              {dog.breed && (
                <p className="text-sm text-gray-400 mt-0.5">{dog.breed}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  dog.sector === 'Plateau'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {dog.sector}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">

            {/* Must-know / Notes alert */}
            {dog.notes && (
              <div className="bg-[#E8634A] text-white rounded-2xl px-4 py-3 flex gap-3 items-start">
                <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-0.5">Notes</p>
                  <p className="text-sm font-medium leading-snug">{dog.notes}</p>
                </div>
              </div>
            )}

            {/* Door code — tap to reveal */}
            {dog.door_code && (
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Door / Access Code</span>
                </div>
                {doorRevealed ? (
                  <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                    <p className="text-2xl font-mono font-bold text-[#1A1A1A] tracking-widest">{dog.door_code}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setDoorRevealed(true)}
                    className="w-full py-3 rounded-xl bg-[#E8634A] text-white text-sm font-bold active:bg-[#d4552d] transition-colors"
                  >
                    Tap to Reveal Code
                  </button>
                )}
              </div>
            )}

            {/* Address */}
            {dog.address && (
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <p className="text-sm text-gray-700 leading-snug">{dog.address}</p>
                  </div>
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[#d4552d]"
                    >
                      Directions
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Owner info */}
            {(dog.owner_first || dog.owner_last) && (
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Owner</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {[dog.owner_first, dog.owner_last].filter(Boolean).join(' ')}
                    </p>
                    {dog.email && (
                      <a href={`mailto:${dog.email}`} className="text-sm text-[#E8634A] font-medium block mt-0.5">
                        {dog.email}
                      </a>
                    )}
                    {dog.phone && (
                      <a href={`tel:${dog.phone}`} className="text-sm text-[#E8634A] font-medium block mt-0.5">
                        {dog.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BFF */}
            {dog.bff && (
              <div className="bg-pink-50 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0">💕</span>
                  <div>
                    <p className="text-xs font-semibold text-pink-400 uppercase tracking-wide mb-0.5">Best Friends</p>
                    <p className="text-sm text-gray-700 leading-snug">{dog.bff}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Goals */}
            {dog.goals && (
              <div className="bg-green-50 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0">🎯</span>
                  <div>
                    <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-0.5">Goals</p>
                    <p className="text-sm text-gray-700 leading-snug">{dog.goals}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
