import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'

export default function SubmitFeedback() {
  const { org, membership } = useOrg()
  const { user } = useAuth()
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    setError('')

    const { data: thread, error: threadErr } = await supabase
      .from('feedback_threads')
      .insert({
        org_id:    org.id,
        team_id:   membership?.team_id ?? null,
        author_id: user.id,
        subject:   subject || null,
      })
      .select()
      .single()

    if (threadErr) { setError(threadErr.message); setLoading(false); return }

    const { error: msgErr } = await supabase.from('feedback_messages').insert({
      thread_id:   thread.id,
      sender_role: 'member',
      body,
    })

    setLoading(false)
    if (msgErr) { setError(msgErr.message); return }
    setDone(true)
  }

  if (done) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Feedback sent anonymously</h2>
        <p className="text-sm text-gray-500 max-w-xs text-center">Your manager will receive it and can reply. Your identity is never revealed.</p>
        <button className="btn-primary mt-6" onClick={() => { setDone(false); setBody(''); setSubject('') }}>
          Send more feedback
        </button>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="p-8 max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Anonymous Feedback</h1>
        <p className="text-sm text-gray-500 mb-8">Your identity is never revealed to your manager.</p>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief topic" />
          </div>
          <div>
            <label className="label">Your feedback</label>
            <textarea
              required className="input h-36 resize-none"
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Share something on your mind…"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Sending…' : 'Send anonymously'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
