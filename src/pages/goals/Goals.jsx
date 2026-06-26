import { useEffect, useState } from 'react'
import { Target, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const STATUS_COLORS = {
  on_track:  'bg-green-100 text-green-700',
  at_risk:   'bg-yellow-100 text-yellow-700',
  off_track: 'bg-red-100 text-red-700',
  complete:  'bg-gray-100 text-gray-600',
}

export default function Goals() {
  const { org } = useOrg()
  const { user } = useAuth()
  const [goals, setGoals]     = useState([])
  const [krs, setKrs]         = useState({})
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)
  const [form, setForm]       = useState({ title: '', description: '', due_date: '', status: 'on_track' })
  const [saving, setSaving]   = useState(false)
  const [krForm, setKrForm]   = useState({})  // { [goalId]: { title, target, unit } }

  useEffect(() => {
    if (!org) return
    supabase.from('goals').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
      .then(({ data }) => { setGoals(data ?? []); setLoading(false) })
  }, [org])

  async function loadKrs(goalId) {
    if (krs[goalId]) return
    const { data } = await supabase.from('key_results').select('*').eq('goal_id', goalId)
    setKrs(prev => ({ ...prev, [goalId]: data ?? [] }))
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] }
      if (next[id]) loadKrs(id)
      return next
    })
  }

  async function createGoal() {
    if (!form.title) return
    setSaving(true)
    const { data } = await supabase.from('goals').insert({
      org_id: org.id, owner_id: user.id, ...form,
      due_date: form.due_date || null,
    }).select().single()
    setGoals(prev => [data, ...prev])
    setSaving(false)
    setOpen(false)
    setForm({ title: '', description: '', due_date: '', status: 'on_track' })
  }

  async function addKr(goalId) {
    const draft = krForm[goalId]
    if (!draft?.title?.trim()) return
    const { data, error } = await supabase.from('key_results').insert({
      goal_id: goalId,
      title:   draft.title,
      target:  draft.target ? parseFloat(draft.target) : null,
      current: 0,
      unit:    draft.unit || null,
    }).select().single()
    if (error) { alert(error.message); return }
    setKrs(prev => ({ ...prev, [goalId]: [...(prev[goalId] ?? []), data] }))
    setKrForm(prev => ({ ...prev, [goalId]: { title: '', target: '', unit: '' } }))
  }

  async function updateKr(kr, field, value) {
    await supabase.from('key_results').update({ [field]: value }).eq('id', kr.id)
    setKrs(prev => ({
      ...prev,
      [kr.goal_id]: prev[kr.goal_id].map(k => k.id === kr.id ? { ...k, [field]: value } : k),
    }))
  }

  function progress(goalId) {
    const list = krs[goalId]
    if (!list || list.length === 0) return 0
    const total = list.reduce((a, k) => a + (parseFloat(k.target) || 0), 0)
    const curr  = list.reduce((a, k) => a + (parseFloat(k.current) || 0), 0)
    return total > 0 ? Math.min(100, Math.round((curr / total) * 100)) : 0
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goals & OKRs</h1>
            <p className="text-sm text-gray-500 mt-1">Track objectives and key results</p>
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
            <Plus size={16} /> New Goal
          </button>
        </div>

        {goals.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet" description="Create a goal and add key results to track progress." action={
            <button className="btn-primary" onClick={() => setOpen(true)}>Create goal</button>
          } />
        ) : (
          <div className="space-y-3">
            {goals.map(goal => {
              const pct = progress(goal.id)
              return (
                <div key={goal.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{goal.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[goal.status]}`}>
                          {goal.status.replace('_', ' ')}
                        </span>
                      </div>
                      {goal.description && <p className="text-xs text-gray-500 mb-2">{goal.description}</p>}
                      {expanded[goal.id] && (
                        <div className="mt-2 mb-1">
                          <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mb-2">{pct}% complete</p>
                          {(krs[goal.id] ?? []).map(kr => (
                            <div key={kr.id} className="flex items-center gap-2 py-1.5 border-t border-gray-50">
                              <span className="text-xs text-gray-700 flex-1">{kr.title}</span>
                              <input
                                type="number" className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5"
                                value={kr.current} min={0} max={kr.target}
                                onChange={e => updateKr(kr, 'current', e.target.value)}
                              />
                              <span className="text-xs text-gray-400">/ {kr.target} {kr.unit}</span>
                            </div>
                          ))}

                          {/* Add a key result */}
                          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-100">
                            <input
                              className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1"
                              placeholder="New key result…"
                              value={krForm[goal.id]?.title ?? ''}
                              onChange={e => setKrForm(p => ({ ...p, [goal.id]: { ...p[goal.id], title: e.target.value } }))}
                              onKeyDown={e => e.key === 'Enter' && addKr(goal.id)}
                            />
                            <input
                              type="number" className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1"
                              placeholder="target"
                              value={krForm[goal.id]?.target ?? ''}
                              onChange={e => setKrForm(p => ({ ...p, [goal.id]: { ...p[goal.id], target: e.target.value } }))}
                            />
                            <input
                              className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1"
                              placeholder="unit"
                              value={krForm[goal.id]?.unit ?? ''}
                              onChange={e => setKrForm(p => ({ ...p, [goal.id]: { ...p[goal.id], unit: e.target.value } }))}
                            />
                            <button onClick={() => addKr(goal.id)} className="text-brand-600 hover:text-brand-700 flex-shrink-0">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleExpand(goal.id)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                      {expanded[goal.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="New Goal">
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Increase customer satisfaction" />
            </div>
            <div>
              <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea className="input h-20 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Due date</label>
                <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="on_track">On track</option>
                  <option value="at_risk">At risk</option>
                  <option value="off_track">Off track</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={createGoal} disabled={saving || !form.title}>
              {saving ? 'Creating…' : 'Create goal'}
            </button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
