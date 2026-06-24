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
      const { data: mem } = await supabase
        .from('memberships')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .maybeSingle()

      setMembership(mem ?? null)
      setOrg(mem?.organizations ?? null)
      setLoading(false)
    }

    load()
  }, [user])

  function refreshOrg() {
    if (user) {
      supabase
        .from('memberships')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data: mem }) => {
          setMembership(mem ?? null)
          setOrg(mem?.organizations ?? null)
        })
    }
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
