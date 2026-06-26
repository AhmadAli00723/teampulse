import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth.jsx'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [membership, setMembership] = useState(null)
  const [org, setOrg]               = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!user) { setMembership(null); setOrg(null); setLoading(false); return }

    async function load() {
      setLoading(true)
      const { data: mems } = await supabase
        .from('memberships')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .order('joined_at')

      // A user may belong to more than one org; default to the earliest membership.
      const mem = mems?.[0] ?? null
      setMembership(mem)
      setOrg(mem?.organizations ?? null)
      setLoading(false)
    }

    load()
  }, [user])

  // Returns a promise so callers can await the refresh before navigating
  function refreshOrg() {
    if (!user) return Promise.resolve()
    return supabase
      .from('memberships')
      .select('*, organizations(*)')
      .eq('user_id', user.id)
      .order('joined_at')
      .then(({ data: mems }) => {
        const mem = mems?.[0] ?? null
        setMembership(mem)
        setOrg(mem?.organizations ?? null)
      })
  }

  return (
    <OrgContext.Provider value={{ membership, org, loading, refreshOrg }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  return useContext(OrgContext)
}
