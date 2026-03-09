import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function PhotoUpload({ dogId, onUploaded }) {
  const [showMenu, setShowMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef()
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file || !dogId) return
    setUploading(true)
    setShowMenu(false)

    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${dogId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('dog-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Upload failed:', uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('dog-photos')
      .getPublicUrl(path)

    const { data, error } = await supabase
      .from('dogs')
      .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', dogId)
      .select()
      .single()

    setUploading(false)
    if (!error && data) {
      onUploaded?.(data)
    }
  }

  return (
    <>
      {/* Camera button overlay */}
      <button
        onClick={() => setShowMenu(true)}
        disabled={uploading}
        className="absolute bottom-0 right-0 w-7 h-7 bg-[#E8634A] rounded-full flex items-center justify-center shadow-md active:bg-[#d4552d] disabled:opacity-50"
      >
        {uploading ? (
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3.5 h-3.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )}
      </button>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />

      {/* Action sheet */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setShowMenu(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-2xl p-4 shadow-2xl" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full py-3.5 rounded-full bg-[#FFF4F1] text-[#E8634A] text-sm font-semibold flex items-center justify-center gap-2 active:bg-[#ffe8e0] min-h-[48px]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Take Photo
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-3.5 rounded-full bg-[#FFF4F1] text-[#E8634A] text-sm font-semibold flex items-center justify-center gap-2 active:bg-[#ffe8e0] min-h-[48px]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                Choose from Files
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3.5 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold mt-1 min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
