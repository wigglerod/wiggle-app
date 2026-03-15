import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function SmartTextInput({ value, onChange, placeholder, rows = 2, className = '' }) {
  const [dogs, setDogs] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const textareaRef = useRef(null)

  useEffect(() => {
    async function fetchDogs() {
      const { data } = await supabase.from('dogs').select('id, dog_name').order('dog_name')
      if (data) setDogs(data)
    }
    fetchDogs()
  }, [])

  const options = useMemo(() => {
    const q = atQuery.toLowerCase()
    const list = dogs.map((d) => ({ label: d.dog_name, id: d.id }))
    if (!q) return list.slice(0, 8)
    return list.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [atQuery, dogs])

  function handleChange(e) {
    const val = e.target.value
    onChange(val)

    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const lastAt = before.lastIndexOf('@')
    if (lastAt >= 0) {
      const afterAt = before.slice(lastAt + 1)
      if (!afterAt.includes('\n') && afterAt.length <= 30) {
        setAtQuery(afterAt)
        setShowDropdown(true)
        setDropdownIndex(0)
        return
      }
    }
    setShowDropdown(false)
  }

  function handleKeyDown(e) {
    if (!showDropdown || options.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectOption(options[dropdownIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  function selectOption(option) {
    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const lastAt = before.lastIndexOf('@')
    const newVal = value.slice(0, lastAt) + '@' + option.label + ' ' + value.slice(cursor)
    onChange(newVal)
    setShowDropdown(false)
    setTimeout(() => {
      const pos = lastAt + option.label.length + 2
      textarea?.setSelectionRange(pos, pos)
      textarea?.focus()
    }, 0)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className || 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#E8634A] resize-none'}
      />
      {showDropdown && options.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {options.map((option, i) => (
            <button
              key={option.id}
              onClick={() => selectOption(option)}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                i === dropdownIndex ? 'bg-[#FFF4F1]' : ''
              }`}
            >
              <span className="text-gray-400">🐕</span>
              <span className="text-gray-700 font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
