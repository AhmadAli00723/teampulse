import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import Layout from '../../components/Layout'

export default function OrgSettings() {
  const { org, refreshOrg } = useOrg()
  const [name, setName]   = useState(org?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('organizations').update({ name }).eq('id', org.id)
    refreshOrg()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Layout>
      <div className="p-8 max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Organization Settings</h1>
        <p className="text-sm text-gray-500 mb-8">Manage your organization profile.</p>
        <form onSubmit={save} className="card space-y-4">
          <div>
            <label className="label">Organization name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Slug</label>
            <input className="input font-mono" value={org?.slug ?? ''} disabled />
            <p className="text-xs text-gray-400 mt-1">Slug cannot be changed after creation.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
