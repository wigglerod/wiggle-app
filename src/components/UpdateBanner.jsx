import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [updateFn, setUpdateFn] = useState(null)

  useEffect(() => {
    function handler(e) {
      setUpdateFn(() => e.detail)
      setShowBanner(true)
    }
    window.addEventListener('wiggle-sw-update', handler)
    return () => window.removeEventListener('wiggle-sw-update', handler)
  }, [])

  function handleUpdate() {
    if (updateFn) updateFn(true)
    else window.location.reload()
  }

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-[#E8634A] text-white px-4 py-2.5 flex items-center justify-between shadow-lg"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
        >
          <span className="text-sm font-semibold">New version available</span>
          <button
            onClick={handleUpdate}
            className="px-3 py-1 rounded-full bg-white text-[#E8634A] text-xs font-bold active:bg-gray-100"
          >
            Update
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
