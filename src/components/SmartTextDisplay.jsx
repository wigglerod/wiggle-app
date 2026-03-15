import { Fragment } from 'react'

const AT_PATTERN = /@([\w\s'-]+?)(?=\s@|\s*$|[.,;!?)\]])/g

export default function SmartTextDisplay({ text, onDogClick, className = '' }) {
  if (!text) return null

  const parts = []
  let lastIndex = 0

  for (const match of text.matchAll(AT_PATTERN)) {
    const name = match[1].trim()
    if (!name) continue

    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: name })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onDogClick?.(part.value) }}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-[#FDEBE7] text-[#E8634A] active:bg-[#E8634A] active:text-white transition-colors mx-0.5"
          >
            @{part.value}
          </button>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </span>
  )
}
