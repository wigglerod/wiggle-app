import { useState, useEffect } from 'react'

function getMapsLinks(address) {
  if (!address) return null
  const encoded = encodeURIComponent(address)
  return {
    apple: `https://maps.apple.com/?q=${encoded}`,
    google: `https://maps.google.com/?q=${encoded}`,
  }
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export default function DogDrawer({ event, onClose }) {
  const [doorRevealed, setDoorRevealed] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Trap scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!event) return null

  const dog = event.dog
  const address = event.location || dog?.address || ''
  const maps = getMapsLinks(address)
  const mapsUrl = isIOS() ? maps?.apple : maps?.google
  const doorCode = event.calendarDoorCode || dog?.doorInfo || null
  const mustKnow = dog?.mustKnow || null
  const extraInfo = dog?.extraInfo || null
  const photoUrl = dog?.photo_url && !imgError ? dog.photo_url : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg font-medium active:bg-gray-200"
        >
          ×
        </button>

        <div className="px-5 pb-8 pt-2">
          {/* Dog photo / avatar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FFF4F1] flex items-center justify-center flex-shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={event.displayName}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-4xl">🐶</span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1A1A1A]">{event.displayName}</h2>
              {event.breed && (
                <p className="text-sm text-gray-400 capitalize mt-0.5">{event.breed}</p>
              )}
              {event.matchType === 'none' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  ⚠️ Profile Missing
                </span>
              )}
              {event.matchType === 'fuzzy' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                  ~ Fuzzy match
                </span>
              )}
            </div>
          </div>

          {/* Must Know — coral warning box */}
          {mustKnow && (
            <div className="bg-[#E8634A] text-white rounded-xl p-3 mb-4 flex gap-2">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide opacity-80 mb-0.5">Must Know</p>
                <p className="text-sm font-medium">{mustKnow}</p>
              </div>
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="text-base mt-0.5">📍</span>
                  <p className="text-sm text-gray-700 leading-snug">{address}</p>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 bg-[#E8634A] text-white text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-[#d4552d]"
                  >
                    Open Maps
                  </a>
                )}
              </div>
              {maps && (
                <div className="flex gap-3 mt-2 ml-6">
                  <a href={maps.apple} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 underline underline-offset-2">Apple Maps</a>
                  <a href={maps.google} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 underline underline-offset-2">Google Maps</a>
                </div>
              )}
            </div>
          )}

          {/* Door code — tap to reveal */}
          {doorCode && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🔑</span>
                <span className="text-sm text-gray-600 font-medium">Door / Access</span>
              </div>
              {doorRevealed ? (
                <p className="mt-2 ml-6 text-sm font-mono font-semibold text-[#1A1A1A] bg-white rounded-lg px-3 py-2 border border-gray-200">
                  {doorCode}
                </p>
              ) : (
                <button
                  onClick={() => setDoorRevealed(true)}
                  className="mt-2 ml-6 text-xs text-[#E8634A] font-semibold underline underline-offset-2 active:opacity-70"
                >
                  Tap to reveal code
                </button>
              )}
            </div>
          )}

          {/* Extra info */}
          {extraInfo && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-base">📝</span>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Extra Info</p>
                  <p className="text-sm text-gray-700">{extraInfo}</p>
                </div>
              </div>
            </div>
          )}

          {/* Calendar description (raw, if no dog profile) */}
          {!dog && event.description && (
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Calendar Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
