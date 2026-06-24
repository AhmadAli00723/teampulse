import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export default function AcceptInvite() {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const token     = params.get('token')

  const [invite, setInvite]   = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) { setError('Invalid invite link.'); setLoading(false); return }
    supabase
      .from('invites')
      .select('*, organizations(name)')
      .eq('token', token)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setError('This invite link is invalid or has expired.')
        else setInvite(data)
        setLoading(false)
      })
  }, [token])

  async function accept() {
    if (!user) { navigate(`/signup?token=${token}`); return }
    setAccepting(true)
    const { error: err } = await supabase.rpc('accept_invite', { p_token: token })
    if (!err) {
      navigate('/')
    } else {
      setError(err.message)
      setAccepting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">TeamPulse</span>
        </div>

        <div className="card text-center">
          {error ? (
            <>
              <p className="text-red-600 font-medium mb-2">Invite invalid</p>
              <p className="text-sm text-gray-500">{error}</p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-gray-900 mb-1">You're invited!</h1>
              <p className="text-sm text-gray-500 mb-6">
                Join <strong>{invite.organizations?.name}</strong> on TeamPulse as a{' '}
                <strong>{invite.role}</strong>.
              </p>
              {user ? (
                <button onClick={accept} disabled={accepting} className="btn-primary w-full">
                  {accepting ? 'Joining…' : 'Accept invite'}
                </button>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => navigate(`/signup?token=${token}`)} className="btn-primary w-full">
                    Create account & join
                  </button>
                  <button onClick={() => navigate(`/login?token=${token}`)} className="btn-secondary w-full">
                    Sign in & join
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
