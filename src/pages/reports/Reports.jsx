import { useEffect, useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { ENGAGEMENT_METRICS } from '../../lib/constants'
import Layout from '../../components/Layout'
import Spinner from '../../components/ui/Spinner'

export default function Reports() {
  const { org } = useOrg()
  const [scores, setScores] = useState([])
  const [enps, setEnps]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org) return
    Promise.all([
      supabase.rpc('get_metric_scores', { p_org_id: org.id }),
      supabase.rpc('get_enps', { p_org_id: org.id }),
    ]).then(([s, e]) => {
      setScores(s.data ?? [])
      setEnps(e.data?.[0] ?? null)
      setLoading(false)
    })
  }, [org])

  function exportCSV() {
    const rows = [['Metric', 'Score', 'Responses', 'Below Threshold']]
    scores.forEach(s => {
      const m = ENGAGEMENT_METRICS.find(m => m.id === s.metric_id)
      rows.push([m?.label ?? s.metric_id, s.avg_score ?? 'N/A', s.response_count, s.below_threshold ? 'Yes' : 'No'])
    })
    if (enps) rows.push(['eNPS', enps.enps ?? 'N/A', enps.total, enps.below_threshold ? 'Yes' : 'No'])
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `teampulse-report-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Engagement summary for {org?.name}</p>
          </div>
          <button className="btn-secondary flex items-center gap-2" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
        </div>

        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Metric Scores</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left pb-2">Metric</th>
                <th className="text-right pb-2">Score</th>
                <th className="text-right pb-2">Responses</th>
              </tr>
            </thead>
            <tbody>
              {ENGAGEMENT_METRICS.map(m => {
                const s = scores.find(sc => sc.metric_id === m.id)
                return (
                  <tr key={m.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-700">{m.label}</td>
                    <td className="text-right py-2.5">
                      {!s || s.below_threshold
                        ? <span className="text-gray-300 text-xs">–</span>
                        : <span className="font-semibold text-gray-900">{s.avg_score}<span className="text-gray-400 font-normal">/10</span></span>
                      }
                    </td>
                    <td className="text-right py-2.5 text-gray-500">{s?.response_count ?? 0}</td>
                  </tr>
                )
              })}
              {enps && (
                <tr>
                  <td className="py-2.5 font-medium text-gray-700">eNPS</td>
                  <td className="text-right py-2.5">
                    {enps.below_threshold
                      ? <span className="text-gray-300 text-xs">–</span>
                      : <span className={`font-semibold ${enps.enps >= 0 ? 'text-green-600' : 'text-red-500'}`}>{enps.enps > 0 ? '+' : ''}{enps.enps}</span>
                    }
                  </td>
                  <td className="text-right py-2.5 text-gray-500">{enps.total}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
