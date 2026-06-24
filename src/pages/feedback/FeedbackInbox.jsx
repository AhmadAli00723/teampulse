import { useEffect, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function FeedbackInbox() {
  const { user } = useAuth()
  const [threads, setThreads]   = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)

  useEffect(() => {
    supabase
      .from('feedback_threads_for_manager')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setThreads(data ?? []); setLoading(false) })
  }, [user])

  useEffect(() => {
    if (!selected) return
    supabase
      .from('feedback_messages')
      .select('*')
      .eq('thread_id', selected.id)
      .order('sent_at')
      .then(({ data }) => setMessages(data ?? []))
  }, [selected])

  async function sendReply(e) {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    const { data } = await supabase.from('feedback_messages').insert({
      thread_id:   selected.id,
      sender_role: 'manager',
      body:        reply,
    }).select().single()
    setMessages(prev => [...prev, data])
    setReply('')
    setSending(false)
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="flex h-screen overflow-hidden">
        {/* Thread list */}
        <div className="w-72 border-r border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h1 className="text-base font-semibold text-gray-900">Feedback Inbox</h1>
            <p className="text-xs text-gray-400 mt-0.5">{threads.length} thread{threads.length !== 1 ? 's' : ''}</p>
          </div>
          {threads.length === 0 ? (
            <div className="p-4"><EmptyState icon={MessageSquare} title="No feedback yet" description="Anonymous feedback from your team will appear here." /></div>
          ) : threads.map(t => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === t.id ? 'bg-brand-50' : ''}`}
            >
              <p className="text-sm font-medium text-gray-800 truncate">{t.subject || 'Anonymous feedback'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
            </button>
          ))}
        </div>

        {/* Thread view */}
        <div className="flex-1 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageSquare} title="Select a thread" description="Click a feedback thread on the left to view and reply." />
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{selected.subject || 'Anonymous feedback'}</p>
                <p className="text-xs text-gray-400">From: Anonymous • {new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_role === 'manager' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                      msg.sender_role === 'manager'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      <p>{msg.body}</p>
                      <p className={`text-xs mt-1 ${msg.sender_role === 'manager' ? 'text-brand-200' : 'text-gray-400'}`}>
                        {msg.sender_role === 'manager' ? 'You' : 'Anonymous'} • {new Date(msg.sent_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <input
                  className="input flex-1"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Reply anonymously…"
                />
                <button type="submit" disabled={sending} className="btn-primary flex items-center gap-1.5">
                  <Send size={14} /> Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
