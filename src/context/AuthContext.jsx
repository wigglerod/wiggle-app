import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getPermissions } from '../lib/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function fetchProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        setProfile(null)
        return
      }
      setProfile(data)
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) fetchProfile(s.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) fetchProfile(s.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const role = profile?.role || null
  const sector = profile?.sector || null
  const schedule = profile?.schedule || null
  const permissions = getPermissions(role)
  const value = {
    session,
    profile,
    user: session?.user ?? null,
    role,
    sector,
    schedule,
    permissions,
    isChiefPup: role === 'admin',
    isAdmin: role === 'admin' || role === 'senior_walker',
    isSenior: role === 'senior_walker',
    isJunior: role === 'junior_walker',
    canEdit: permissions.canEditGroups,
    canDelete: role === 'admin',
    isLoading: session === undefined,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
