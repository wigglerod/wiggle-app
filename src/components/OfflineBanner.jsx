import { motion, AnimatePresence } from 'framer-motion'
import { useOffline } from '../lib/useOffline'

export default function OfflineBanner() {
  const { isOffline } = useOffline()

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-800 text-white text-center text-xs font-semibold py-1.5 px-4 overflow-hidden z-[200] relative"
        >
          Offline — showing last synced data
        </motion.div>
      )}
    </AnimatePresence>
  )
}
