import { useEffect, useState } from 'react'
import { Send, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { ENGAGEMENT_METRICS, CADENCE_OPTIONS } from '../../lib/constants'
import Layout from '../../components/Layout'
import Spinner from '../../components/ui/Spinner'

export default function SurveySettings() {
  const { org } = useOrg()
  const [cycle, setCycle]       = useState(null)
  const [cadence, setCadence]   = useState('weekly')
  const [metrics, setMetrics]   = useState(ENGAGEMENT_METRICS.map(m => m.id))
  const [nextSend, setNextSend] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sending, setSending]   = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    if (!org) return
    supabase
      .from('survey_cycles')
      .select('*')
      .eq('org_id', org.id)
      .is('team_id', null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCycle(data)
          setCadence(data.cadence)
          setMetrics(data.metrics?.length ? data.metrics : ENGAGEMENT_METRICS.map(m => m.id))
          setNextSend(data.next_send ?? '')
        }
        setLoading(false)
      })
  }, [org])

  function toggleMetric(id) {
    setMetrics(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  async function save() {
    if (metrics.length === 0) { setSaveError('Select at least one metric.'); return }
    setSaving(true)
    setSaveError('')
    const payload = { cadence, metrics, active: true, next_send: nextSend || null }
    if (cycle) {
      const { error } = await supabase.from('survey_cycles').update(payload).eq('id', cycle.id)
      if (error) { setSaveError(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('survey_cycles')
        .insert({ org_id: org.id, ...payload })
        .select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      setCycle(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function sendNow() {
    setSending(true)
    setSendResult(null)
    const { data, error } = await supabase.functions.invoke('send-surveys', {
      body: { org_id: org.id, force: true },
    })
    setSending(false)
    if (error) {
      setSendResult({ ok: false, error: data?.error ?? error.message })
    } else {
      setSendResult(data)
      // Refresh cycle to get updated next_send / last_sent from the server
      supabase.from('survey_cycles').select('*')
        .eq('org_id', org.id).is('team_id', null).maybeSingle()
        .then(({ data: c }) => { if (c) { setCycle(c); setNextSend(c.next_send ?? '') } })
    }
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  const lastSent = cycle?.last_sent

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Survey Settings</h1>
        <p className="text-sm text-gray-500 mb-8">Configure pulse survey cadence, metrics and delivery schedule.</p>

        {/* ── Cadence ── */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Survey Cadence</h2>
          <div className="flex gap-3">
            {CADENCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCadence(opt.value)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                  cadence === opt.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-gray-200 text-gray-600 hover:border-brand-400'
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">
            Active Metrics <span className="text-gray-400 font-normal">({metrics.length} selected)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {ENGAGEMENT_METRICS.map(m => (
              <label
                key={m.id}
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                  metrics.includes(m.id) ? 'border-brand-300 bg-brand-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={metrics.includes(m.id)}
                  onChange={() => toggleMetric(m.id)}
                  className="accent-brand-600"
                />
                <span className="text-sm font-medium text-gray-700">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Scheduling ── */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Scheduling</h2>
          <p className="text-xs text-gray-400 mb-4">
            Set the date of the first (or next) automatic send. After each send the date
            auto-advances by your chosen cadence.
          </p>
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <label className="label flex items-center gap-1.5">
                <Calendar size={13} className="text-gray-400" /> Next send date
              </label>
              <input
                type="date"
                className="input"
                value={nextSend}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setNextSend(e.target.value)}
              />
            </div>
            {lastSent && (
              <div className="flex-1">
                <p className="label flex items-center gap-1.5">
                  <Clock size={13} className="text-gray-400" /> Last sent
                </p>
                <p className="text-sm text-gray-700 pt-2.5">
                  {new Date(lastSent).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Save ── */}
        {saveError && (
          <p className="text-sm text-red-600 mb-3 flex items-center gap-1.5">
            <AlertCircle size={14} /> {saveError}
          </p>
        )}
        <button onClick={save} disabled={saving} className="btn-primary mb-10">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </button>

        {/* ── Send Now ── */}
        <div className="card border-2 border-dashed border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Send size={18} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Send survey now</h2>
              <p className="text-xs text-gray-500 mb-4">
                Instantly email the pulse survey to every member of <strong>{org?.name}</strong>.
                Use this for a one-off send outside the regular schedule — the next
                automatic send will still go out on the date you set above.
              </p>
              <button
                onClick={sendNow}
                disabled={sending}
                className="btn-primary flex items-center gap-2"
              >
                <Send size={14} />
                {sending ? 'Sending emails…' : 'Send to all members now'}
              </button>

              {sendResult && (
                <div className={`mt-3 flex items-center gap-2 text-sm rounded-xl p-3 ${
                  sendResult.ok
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {sendResult.ok ? (
                    <>
                      <CheckCircle2 size={15} className="flex-shrink-0" />
                      Survey sent to{' '}
                      <strong>{sendResult.emails_sent}</strong>{' '}
                      member{sendResult.emails_sent !== 1 ? 's' : ''}!
                      Next auto-send scheduled automatically.
                    </>
                  ) : (
                    <>
                      <AlertCircle size={15} className="flex-shrink-0" />
                      {sendResult.error}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
