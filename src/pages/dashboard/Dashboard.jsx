import { useEffect, useState } from 'react'
import { Lock, TrendingUp, Users, BarChart2 } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
         LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { ENGAGEMENT_METRICS, RESPONSE_THRESHOLD } from '../../lib/constants'
import Layout from '../../components/Layout'
import Spinner from '../../components/ui/Spinner'

function ScoreCard({ metric, score, belowThreshold }) {
  return (
    <div className="card flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{metric.label}</p>
      {belowThreshold ? (
        <div className="flex items-center gap-1.5 text-gray-400">
          <Lock size={14} />
          <span className="text-xs">Need {RESPONSE_THRESHOLD}+ responses</span>
        </div>
      ) : (
        <p className="text-3xl font-bold text-gray-900">
          {score ?? '–'}<span className="text-base font-normal text-gray-400">/10</span>
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { org } = useOrg()
  const [scores, setScores]   = useState([])
  const [enps, setEnps]       = useState(null)
  const [trend, setTrend]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org) return
    async function load() {
      setLoading(true)
      const [scoresRes, enpsRes, trendRes] = await Promise.all([
        supabase.rpc('get_metric_scores', { p_org_id: org.id }),
        supabase.rpc('get_enps', { p_org_id: org.id }),
        supabase.rpc('get_metric_trend', { p_org_id: org.id, p_weeks: 12 }),
      ])
      setScores(scoresRes.data ?? [])
      setEnps(enpsRes.data?.[0] ?? null)
      setTrend(trendRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [org])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64"><Spinner /></div>
    </Layout>
  )

  const scoreMap = Object.fromEntries(scores.map(s => [s.metric_id, s]))

  const radarData = ENGAGEMENT_METRICS.map(m => ({
    subject: m.label.split(' ')[0],
    score: scoreMap[m.id]?.below_threshold ? 0 : (scoreMap[m.id]?.avg_score ?? 0),
  }))

  const overallScores = scores.filter(s => !s.below_threshold && s.avg_score !== null)
  const overallAvg = overallScores.length
    ? (overallScores.reduce((a, b) => a + parseFloat(b.avg_score), 0) / overallScores.length).toFixed(1)
    : null

  // Pivot trend rows ({period_start, metric_id, avg_score}) into one row per week
  // with a column per metric, so all lines share a single x-axis.
  const periods = [...new Set(trend.map(r => r.period_start))].sort()
  const metricsInTrend = new Set(trend.map(r => r.metric_id))
  const trendData = periods.map(p => {
    const row = { period_start: p }
    trend.filter(r => r.period_start === p).forEach(r => { row[r.metric_id] = r.avg_score })
    return row
  })

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Engagement Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{org?.name} — overall team health</p>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Overall Score</p>
            {overallAvg ? (
              <p className="text-3xl font-bold text-brand-600">{overallAvg}<span className="text-base font-normal text-gray-400">/10</span></p>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-400 mt-1"><Lock size={14} /><span className="text-xs">Not enough data</span></div>
            )}
          </div>
          <div className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">eNPS</p>
            {enps && !enps.below_threshold ? (
              <p className="text-3xl font-bold" style={{ color: enps.enps >= 0 ? '#10b981' : '#ef4444' }}>{enps.enps > 0 ? '+' : ''}{enps.enps}</p>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-400 mt-1"><Lock size={14} /><span className="text-xs">Need {RESPONSE_THRESHOLD}+ responses</span></div>
            )}
          </div>
          <div className="card">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Responses</p>
            <p className="text-3xl font-bold text-gray-900">{enps?.total ?? 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Metric score cards */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            {ENGAGEMENT_METRICS.map(m => {
              const s = scoreMap[m.id]
              return <ScoreCard key={m.id} metric={m} score={s?.avg_score} belowThreshold={!s || s.below_threshold} />
            })}
          </div>

          {/* Radar chart */}
          <div className="card flex flex-col">
            <p className="text-sm font-semibold text-gray-800 mb-4">Engagement Shape</p>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Trend lines */}
        {trendData.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold text-gray-800 mb-4">Score Trends (12 weeks)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period_start" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5)} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip />
                {ENGAGEMENT_METRICS.map(m => (
                  metricsInTrend.has(m.id) && (
                    <Line key={m.id} dataKey={m.id} connectNulls
                      stroke={m.color} dot={false} strokeWidth={2} name={m.label} />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Layout>
  )
}
