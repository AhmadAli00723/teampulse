import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { ENGAGEMENT_METRICS, CADENCE_OPTIONS } from '../../lib/constants'
import Layout from '../../components/Layout'
import Spinner from '../../components/ui/Spinner'

export default function SurveySettings() {
  const { org } = useOrg()
  const [cycle, setCycle]     = useState(null)
  const [cadence, setCadence] = useState('weekly')
  const [metrics, setMetrics] = useState(ENGAGEMENT_METRICS.map(m => m.id))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

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
        }
        setLoading(false)
      })
  }, [org])

  function toggleMetric(id) {
    setMetrics(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  async function save() {
    setSaving(true)
    if (cycle) {
      await supabase
        .from('survey_cycles')
        .update({ cadence, metrics })
        .eq('id', cycle.id)
    } else {
      const { data } = await supabase
        .from('survey_cycles')
        .insert({ org_id: org.id, cadence, metrics, active: true })
        .select()
        .single()
      setCycle(data)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Survey Settings</h1>
        <p className="text-sm text-gray-500 mb-8">Configure your pulse survey cadence and which metrics to track.</p>

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

        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
        </button>
      </div>
    </Layout>
  )
}
