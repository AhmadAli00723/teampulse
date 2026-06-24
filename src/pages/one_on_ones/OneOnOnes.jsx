import { useEffect, useState } from 'react'
import { Users, Plus, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function OneOnOnes() {
  const { org, membership } = useOrg()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [items, setItems]       = useState([])
  const [newItem, setNewItem]   = useState('')
  const [itemType, setItemType] = useState('agenda')
  const [loading, setLoading]   = useState(true)
  const [members, setMembers]   = useState([])
  const [form, setForm]         = useState({ member_id: '', scheduled_at: '' })
  const [creating, setCreating] = useState(false)

  const isManager = ['admin', 'manager'].includes(membership?.role)

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.from('one_on_ones')
        .select('*')
        .eq('org_id', org.id)
        .or(`manager_id.eq.${user.id},member_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase.from('memberships').select('user_id, full_name').eq('org_id', org.id),
    ]).then(([{ data: s }, { data: m }]) => {
      setSessions(s ?? [])
      setMembers(m ?? [])
      setLoading(false)
    })
  }, [org, user])

  useEffect(() => {
    if (!selected) return
    supabase.from('oo_items').select('*').eq('oo_id', selected.id).order('created_at')
      .then(({ data }) => setItems(data ?? []))
  }, [selected])

  async function createSession() {
    if (!form.member_id) return
    setCreating(true)
    const { data } = await supabase.from('one_on_ones').insert({
      org_id: org.id, manager_id: user.id, member_id: form.member_id,
      scheduled_at: form.scheduled_at || null,
    }).select().single()
    setSessions(prev => [data, ...prev])
    setCreating(false)
    setForm({ member_id: '', scheduled_at: '' })
  }

  async function addItem() {
    if (!newItem.trim() || !selected) return
    const { data } = await supabase.from('oo_items').insert({
      oo_id: selected.id, type: itemType, text: newItem, done: false,
    }).select().single()
    setItems(prev => [...prev, data])
    setNewItem('')
  }

  async function toggleItem(item) {
    await supabase.from('oo_items').update({ done: !item.done }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i))
  }

  const nameOf = uid => members.find(m => m.user_id === uid)?.full_name ?? uid

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        {/* Sessions list */}
        <div className="w-72 border-r border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-base font-semibold text-gray-900">1-on-1s</h1>
            {isManager && (
              <div className="mt-3 space-y-2">
                <select className="input text-xs" value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                  <option value="">Select member…</option>
                  {members.filter(m => m.user_id !== user.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                  ))}
                </select>
                <input type="datetime-local" className="input text-xs" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                <button className="btn-primary text-xs w-full flex items-center justify-center gap-1" onClick={createSession} disabled={creating || !form.member_id}>
                  <Plus size={12} /> New 1-on-1
                </button>
              </div>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="p-4"><EmptyState icon={Users} title="No sessions yet" /></div>
          ) : sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === s.id ? 'bg-brand-50' : ''}`}
            >
              <p className="text-sm font-medium text-gray-800">{nameOf(s.manager_id === user.id ? s.member_id : s.manager_id)}</p>
              {s.scheduled_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(s.scheduled_at).toLocaleDateString()}</p>}
            </button>
          ))}
        </div>

        {/* Session detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState icon={Users} title="Select a 1-on-1" description="Choose a session on the left to view agenda and action items." />
            </div>
          ) : (
            <div className="p-6 max-w-xl">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                1-on-1 with {nameOf(selected.manager_id === user.id ? selected.member_id : selected.manager_id)}
              </h2>

              <div className="flex gap-2 mb-4">
                {['agenda', 'action'].map(t => (
                  <button key={t} onClick={() => setItemType(t)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${itemType === t ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600'}`}>
                    {t === 'agenda' ? 'Agenda' : 'Action items'}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <input className="input flex-1 text-sm" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder={itemType === 'agenda' ? 'Add agenda topic…' : 'Add action item…'} />
                <button className="btn-primary" onClick={addItem}><Plus size={16} /></button>
              </div>

              <div className="space-y-2">
                {items.filter(i => i.type === itemType).map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <button onClick={() => toggleItem(item)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.done ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                      {item.done && <Check size={10} className="text-white" />}
                    </button>
                    <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
