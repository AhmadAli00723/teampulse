import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { TrendingUp, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Signup() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const token          = searchParams.get('token') // invite token, if present

  const [form, setForm]                 = useState({ name: '', email: '', password: '' })
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })
    setLoading(false)
    if (err) { setError(err.message); return }

    if (!data.session) {
      // Supabase requires email confirmation before session is issued
      // Save the invite token to localStorage so it survives the confirmation redirect
      if (token) localStorage.setItem('pendingInviteToken', token)
      setNeedsConfirm(true)
      return
    }

    // Logged in immediately — go accept invite or start onboarding
    navigate(token ? `/accept-invite?token=${token}` : '/onboarding')
  }

  // ── Email confirmation holding screen ──────────────────────────────────────
  if (needsConfirm) {
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
            <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-brand-600" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 mb-4">
              We sent a confirmation link to <strong>{form.email}</strong>.
              Click it to verify your account, then come back and accept your invitation.
            </p>
            {token && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 break-all font-mono">
                {window.location.origin}/accept-invite?token={token}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Signup form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">TeamPulse</span>
        </div>

        <div className="card">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-500 mb-6">
            {token ? 'Create an account to accept your invitation' : 'Start measuring what matters'}
          </p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                type="text" required className="input"
                value={form.name} onChange={set('name')}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="label">Work email</label>
              <input
                type="email" required className="input"
                value={form.email} onChange={set('email')}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required minLength={6} className="input"
                value={form.password} onChange={set('password')}
                placeholder="At least 6 characters"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              to={token ? `/login?token=${token}` : '/login'}
              className="text-brand-600 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
