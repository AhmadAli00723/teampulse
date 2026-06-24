import { useEffect, useState } from 'react'
import { BarChart2, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Polls() {
  const { org, membership } = useOrg()
  const { user } = useAuth()
  const [polls, setPolls]     = useState([])
  const [votes, setVotes]     = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)
  const [form, setForm]       = useState({ question: '', options: ['', ''] })
  const [saving, setSaving]   = useState(false)

  const canCreate = ['admin', 'manager'].includes(membership?.role)

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.from('polls').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('poll_id, option_idx').eq('user_id', user.id),
    ]).then(([{ data: p }, { data: v }]) => {
      setPolls(p ?? [])
      const vmap = {}
      ;(v ?? []).forEach(vote => { vmap[vote.poll_id] = vote.option_idx })
      setVotes(vmap)
      setLoading(false)
    })
  }, [org, user])

  async function vote(pollId, optionIdx) {
    if (votes[pollId] !== undefined) return
    const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, user_id: user.id, option_idx: optionIdx })
    if (!error) setVotes(prev => ({ ...prev, [pollId]: optionIdx }))
  }

  async function createPoll() {
    const options = form.options.filter(o => o.trim())
    if (!form.question || options.length < 2) return
    setSaving(true)
    const { data } = await supabase.from('polls').insert({
      org_id: org.id, created_by: user.id, question: form.question, options,
    }).select().single()
    setPolls(prev => [data, ...prev])
    setSaving(false)
    setOpen(false)
    setForm({ question: '', options: ['', ''] })
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
            <p className="text-sm text-gray-500 mt-1">Quick team polls for instant feedback</p>
          </div>
          {canCreate && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setOpen(true)}>
              <Plus size={16} /> Create Poll
            </button>
          )}
        </div>

        {polls.length === 0 ? (
          <EmptyState icon={BarChart2} title="No polls yet" description="Create a quick poll to get your team's opinion." />
        ) : (
          <div className="space-y-4">
            {polls.map(poll => {
              const userVote = votes[poll.id]
              const hasVoted = userVote !== undefined
              return (
                <div key={poll.id} className="card">
                  <p className="text-sm font-semibold text-gray-900 mb-4">{poll.question}</p>
                  <div className="space-y-2">
                    {poll.options.map((opt, idx) => {
                      const isSelected = userVote === idx
                      return (
                        <button
                          key={idx}
                          onClick={() => vote(poll.id, idx)}
                          disabled={hasVoted}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            isSelected ? 'bg-brand-600 text-white border-brand-600'
                            : hasVoted ? 'border-gray-100 text-gray-400 cursor-default'
                            : 'border-gray-200 text-gray-700 hover:border-brand-400'
                          }`}
                        >{opt}</button>
                      )
                    })}
                  </div>
                  {!hasVoted && <p className="text-xs text-gray-400 mt-3">Click an option to vote</p>}
                </div>
              )
            })}
          </div>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Create Poll">
          <div className="space-y-4">
            <div>
              <label className="label">Question</label>
              <input className="input" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} placeholder="What would you like to ask?" />
            </div>
            <div>
              <label className="label">Options</label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={opt} onChange={e => {
                      const opts = [...form.options]; opts[i] = e.target.value; setForm(f => ({ ...f, options: opts }))
                    }} placeholder={`Option ${i + 1}`} />
                    {form.options.length > 2 && (
                      <button onClick={() => setForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
                    )}
                  </div>
                ))}
                {form.options.length < 6 && (
                  <button className="text-sm text-brand-600 hover:underline" onClick={() => setForm(f => ({ ...f, options: [...f.options, ''] }))}>+ Add option</button>
                )}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={createPoll} disabled={saving}>
              {saving ? 'Creating…' : 'Create poll'}
            </button>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
