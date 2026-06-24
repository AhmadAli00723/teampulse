import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useOrg } from '../../hooks/useOrg'

function toSlug(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50)
}

export default function CreateOrg() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshOrg } = useOrg()

  const [name, setName]       = useState('')
  const [slug, setSlug]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleNameChange(e) {
    const val = e.target.value
    setName(val)
    setSlug(toSlug(val))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!slug) { setError('Slug is required.'); return }
    setError('')
    setLoading(true)

    const { data: orgId, error: rpcErr } = await supabase
      .rpc('create_organization', { p_name: name, p_slug: slug })

    setLoading(false)
    if (rpcErr) { setError(rpcErr.message); return }
    if (!orgId) { setError('Failed to create organization.'); return }
    refreshOrg()
    navigate('/dashboard')
  }

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
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Building2 size={20} className="text-brand-600" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Create your organization</h1>
              <p className="text-xs text-gray-500">You'll be the admin</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Organization name</label>
              <input
                type="text" required className="input"
                value={name} onChange={handleNameChange}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="label">Slug (URL identifier)</label>
              <input
                type="text" required className="input font-mono text-sm"
                value={slug} onChange={e => setSlug(toSlug(e.target.value))}
                placeholder="acme-corp"
              />
              <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, hyphens</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating…' : 'Create organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
