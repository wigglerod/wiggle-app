import { motion } from 'framer-motion'

export default function LoadingDog({ text = 'Wiggling...' }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <motion.img
        src="/play.jpg"
        alt="Loading"
        className="w-24 h-24 object-contain"
        animate={{
          y: [0, -10, 0, -6, 0],
          rotate: [-4, 4, -4],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <p className="text-sm text-gray-400 font-medium tracking-wide">{text}</p>
    </div>
  )
}
