import { useEffect, useState } from 'react'
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { startOfISOWeek } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../hooks/useOrg'
import { useAuth } from '../../hooks/useAuth'
import Layout from '../../components/Layout'
import Spinner from '../../components/ui/Spinner'

export default function AnswerSurvey() {
  const { org, membership } = useOrg()
  const { user } = useAuth()

  const [questions, setQuestions] = useState([])
  const [answered, setAnswered]   = useState(new Set())
  const [current, setCurrent]     = useState(0)
  const [score, setScore]         = useState(null)
  const [text, setText]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]           = useState(false)

  const periodStart = startOfISOWeek(new Date()).toISOString().slice(0, 10)

  useEffect(() => {
    if (!org) return
    async function load() {
      setLoading(true)

      // Check already answered this week
      const { data: existing } = await supabase
        .from('survey_responses')
        .select('question_id')
        .eq('user_id', user.id)
        .eq('org_id', org.id)
        .eq('period_start', periodStart)

      const answeredSet = new Set((existing ?? []).map(r => r.question_id))
      setAnswered(answeredSet)

      // Load question library (built-in + org-specific)
      const { data: qs } = await supabase
        .from('question_library')
        .select('*')
        .or(`org_id.eq.${org.id},is_builtin.eq.true`)

      // One question per metric, not yet answered
      const seen = new Set()
      const filtered = (qs ?? []).filter(q => {
        if (answeredSet.has(q.id)) return false
        if (seen.has(q.metric_id)) return false
        seen.add(q.metric_id)
        return true
      })

      setQuestions(filtered)
      setLoading(false)
    }
    load()
  }, [org, user, periodStart])

  async function submitCurrent() {
    const q = questions[current]
    setSubmitting(true)

    await supabase.from('survey_responses').upsert({
      org_id:        org.id,
      team_id:       membership?.team_id ?? null,
      question_id:   q.id,
      metric_id:     q.metric_id,
      user_id:       user.id,
      score:         q.type !== 'text' ? score : null,
      text_response: text || null,
      period_start:  periodStart,
    }, { onConflict: 'user_id,question_id,period_start' })
    setSubmitting(false)
    setScore(null)
    setText('')

    if (current + 1 >= questions.length) {
      setDone(true)
    } else {
      setCurrent(c => c + 1)
    }
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><Spinner /></div></Layout>

  if (done || (questions.length === 0 && answered.size > 0)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full py-24">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">You're all caught up!</h2>
          <p className="text-gray-500 text-sm">Your survey for this week is complete. Check back next week.</p>
        </div>
      </Layout>
    )
  }

  if (questions.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full py-24">
          <p className="text-gray-500">No survey questions available right now.</p>
        </div>
      </Layout>
    )
  }

  const q = questions[current]
  const progress = ((current) / questions.length) * 100

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Question {current + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-3">
            {q.metric_id?.replace(/_/g, ' ')}
          </p>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 leading-snug">{q.text}</h2>

          {q.type === 'text' ? (
            <textarea
              className="input h-28 resize-none"
              placeholder="Share your thoughts…"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-gray-400 px-1 mb-1">
                <span>Not at all</span>
                <span>Absolutely</span>
              </div>
              <div className="flex gap-1.5 justify-center">
                {Array.from({ length: q.type === 'scale_5' ? 5 : 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium border transition-all ${
                      score === n
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'border-gray-200 text-gray-600 hover:border-brand-400'
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => { if (current > 0) { setCurrent(c => c - 1); setScore(null); setText('') } }}
              disabled={current === 0}
              className="btn-secondary flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={submitCurrent}
              disabled={submitting || (q.type !== 'text' && score === null)}
              className="btn-primary flex items-center gap-1"
            >
              {submitting ? 'Saving…' : current + 1 === questions.length ? 'Submit' : 'Next'}
              {!submitting && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
