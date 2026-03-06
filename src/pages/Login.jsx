import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [remember, setRemember] = useState(true)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, AuthContext listener handles session → router redirects
  }

  return (
    <div className="min-h-screen bg-[#FFF4F1] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <img
          src="/LogoWiggleRGB-01.png"
          alt="Wiggle Dog Walks"
          className="w-48 object-contain"
        />
      </div>

      {/* Form card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-5">Walker Sign In</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8634A] focus:border-transparent"
            />
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[#E8634A] rounded"
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#E8634A] text-white font-bold text-sm shadow-sm active:bg-[#d4552d] disabled:opacity-60 transition-all mt-1"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        Wiggle Dog Walks · Montréal, QC
      </p>
    </div>
  )
}
