import { useEffect, useState } from 'react'
import { Heart, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import { VALUE_TAGS } from '../../lib/constants'
import Layout from '../../components/Layout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Recognition() {
  const { org } = useOrg()
  const { user } = useAuth()
  const [items, setItems]       = useState([])
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState({ receiver_id: '', message: '', value_tag: '' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.from('recognitions').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('memberships').select('user_id, full_name').eq('org_id', org.id),
    ]).then(([{ data: r }, { data: m }]) => {
      setItems(r ?? [])
      setMembers(m ?? [])
      setLoading(false)
    })
  }, [org])

  async function send() {
    if (!form.receiver_id || !form.message) return
    setSaving(true)
    const { data, error } = await supabase.from('recognitions').insert({
      org_id:      org.id,
      giver_id:    user.id,
      receiver_id: form.receiver_id,
      message:     form.message,
      value_tag:   form.value_tag || null,
      public:      true,
    }).select('*').single()
    setSaving(false)
    if (error) { alert(error.message); return }
    setItems(prev => [data, ...prev])
    setOpen(false)
    setForm({ receiver_id: '', message: '', value_tag: '' })
  }

  const nameOf = uid => members.find(m => m.user_id === uid)?.full_name ?? 'Someone'

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recognition</h1>
            <p className="text-sm text-gray-500 mt-1">Celebrate your teammates' wins</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
            <Plus size={16} /> Send Good Vibes
          </button>
        </div>

        {items.length === 0 ? (
          <EmptyState icon={Heart} title="No recognitions yet" description="Be the first to send a Good Vibe to a teammate." action={
            <button className="btn-primary" onClick={() => setOpen(true)}>Send Good Vibes</button>
          } />
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="card flex gap-4">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Heart size={18} className="text-pink-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{nameOf(item.giver_id)}</span>
                    {' recognized '}
                    <span className="font-semibold">{nameOf(item.receiver_id)}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">"{item.message}"</p>
                  {item.value_tag && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-brand-50 text-brand-600 text-xs font-medium rounded-full">
                      {item.value_tag}
                    </span>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Send Good Vibes">
          <div className="space-y-4">
            <div>
              <label className="label">Recognize</label>
              <select className="input" value={form.receiver_id} onChange={e => setForm(f => ({ ...f, receiver_id: e.target.value }))}>
                <option value="">Select a teammate…</option>
                {members.filter(m => m.user_id !== user.id).map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name || m.user_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input h-24 resize-none" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What did they do that deserves recognition?" />
            </div>
            <div>
              <label className="label">Value tag <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {VALUE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setForm(f => ({ ...f, value_tag: f.value_tag === tag ? '' : tag }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      form.value_tag === tag ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-400'
                    }`}
                  >{tag}</button>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={send} disabled={saving || !form.receiver_id || !form.message}>
              {saving ? 'Sending…' : 'Send recognition'}
            </button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
