import { motion } from 'framer-motion'

const PAW = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
    <ellipse cx="7" cy="10" rx="2.5" ry="3" />
    <ellipse cx="17" cy="10" rx="2.5" ry="3" />
    <ellipse cx="4" cy="5" rx="2" ry="2.5" />
    <ellipse cx="20" cy="5" rx="2" ry="2.5" />
    <ellipse cx="12" cy="4" rx="2" ry="2.5" />
    <path d="M12 14c-3 0-5.5 2.5-5.5 5.5 0 1.5 1.2 2.5 2.8 2.5h5.4c1.6 0 2.8-1 2.8-2.5 0-3-2.5-5.5-5.5-5.5z" />
  </svg>
)

export default function LoadingDog({ text = 'Wiggling...' }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="text-[#E8634A]"
            animate={{
              y: [0, -10, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          >
            {PAW}
          </motion.div>
        ))}
      </div>
      <p className="text-sm text-gray-400 font-medium tracking-wide">{text}</p>
    </div>
  )
}
