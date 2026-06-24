// TeamPulse — Edge Function: send-surveys
// Triggered by pg_cron daily OR manually from Survey Settings ("Send now")
// Finds all active survey_cycles that are due, emails every member via Resend,
// then advances next_send by the cadence interval.
//
// Required env vars (set via: supabase secrets set KEY=value):
//   SUPABASE_URL            — auto-set by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-set by Supabase runtime
//   RESEND_API_KEY          — from resend.com
//   FROM_EMAIL              — e.g. "TeamPulse <surveys@yourdomain.com>"
//   APP_URL                 — e.g. "https://yourapp.vercel.app"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { org_id, force = false } = body as { org_id?: string; force?: boolean }

    const today      = new Date().toISOString().slice(0, 10)
    const APP_URL    = Deno.env.get('APP_URL')     ?? 'http://localhost:5173'
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL')  ?? 'TeamPulse <onboarding@resend.dev>'

    let totalSent = 0

    // ── FORCE MODE (Send Now button) ──────────────────────────────────────────
    // Send directly to all org members — no cycle row required
    if (force && org_id) {
      // Get org name
      const { data: orgRow } = await admin
        .from('organizations').select('name').eq('id', org_id).single()
      const orgName = orgRow?.name ?? 'your team'

      // Get all members of the org
      const { data: members, error: memErr } = await admin
        .from('memberships').select('user_id, full_name').eq('org_id', org_id)

      if (memErr) throw new Error('Could not load members: ' + memErr.message)
      if (!members || members.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'No members found in this org. Go to Settings → Members and invite your team first.' }),
          { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }

      for (const m of members) {
        const { data: authData } = await admin.auth.admin.getUserById(m.user_id)
        const email = authData?.user?.email
        if (!email) continue

        const firstName = (m.full_name ?? '').split(' ')[0] || 'there'

        if (RESEND_KEY) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    FROM_EMAIL,
              to:      email,
              subject: `📊 Your ${orgName} pulse survey is ready`,
              html:    buildEmail(firstName, orgName, `${APP_URL}/surveys/answer`),
            }),
          })
          if (!res.ok) {
            const errText = await res.text()
            console.error(`Resend error for ${email}:`, errText)
            continue
          }
        } else {
          console.log(`[DRY RUN — no RESEND_API_KEY set] Would email: ${email}`)
        }

        // Log the send
        await admin.from('notification_log').insert({
          org_id, type: 'survey_send', channel: 'email', recipient: email, success: true,
        }).catch(() => {})

        totalSent++
      }

      // Upsert the survey_cycle so next_send advances (create it if it doesn't exist)
      const next = new Date(today)
      next.setDate(next.getDate() + 7) // default weekly

      const { data: existingCycle } = await admin
        .from('survey_cycles').select('id, cadence').eq('org_id', org_id).is('team_id', null).maybeSingle()

      if (existingCycle) {
        // Advance by the configured cadence
        const n = new Date(today)
        if (existingCycle.cadence === 'biweekly') n.setDate(n.getDate() + 14)
        else if (existingCycle.cadence === 'monthly') n.setDate(n.getDate() + 30)
        else n.setDate(n.getDate() + 7)
        await admin.from('survey_cycles').update({
          next_send: n.toISOString().slice(0, 10),
          last_sent: today,
        }).eq('id', existingCycle.id)
      } else {
        // No cycle yet — create one with weekly cadence
        await admin.from('survey_cycles').insert({
          org_id, active: true, cadence: 'weekly',
          next_send: next.toISOString().slice(0, 10),
          last_sent: today,
        })
      }

      return new Response(
        JSON.stringify({ ok: true, cycles_processed: 1, emails_sent: totalSent }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ── SCHEDULED MODE (pg_cron daily trigger) ────────────────────────────────
    let q = admin
      .from('survey_cycles')
      .select('*, organizations(name)')
      .eq('active', true)
      .lte('next_send', today)
      .not('next_send', 'is', null)

    if (org_id) q = (q as any).eq('org_id', org_id)

    const { data: cycles, error: cycleErr } = await q
    if (cycleErr) throw new Error(cycleErr.message)

    for (const cycle of cycles ?? []) {
      let mq = admin
        .from('memberships').select('user_id, full_name').eq('org_id', cycle.org_id)
      if (cycle.team_id) mq = (mq as any).eq('team_id', cycle.team_id)

      const { data: members } = await mq

      for (const m of members ?? []) {
        const { data: authData } = await admin.auth.admin.getUserById(m.user_id)
        const email = authData?.user?.email
        if (!email) continue

        const firstName = (m.full_name ?? '').split(' ')[0] || 'there'
        const orgName   = (cycle as any).organizations?.name ?? 'your team'

        if (RESEND_KEY) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    FROM_EMAIL,
              to:      email,
              subject: `📊 Your ${orgName} pulse survey is ready`,
              html:    buildEmail(firstName, orgName, `${APP_URL}/surveys/answer`),
            }),
          })
          if (!res.ok) {
            console.error(`Resend error for ${email}:`, await res.text())
            continue
          }
        } else {
          console.log(`[DRY RUN] Would email ${email}`)
        }

        await admin.from('notification_log').insert({
          org_id: cycle.org_id, type: 'survey_send', channel: 'email',
          recipient: email, success: true,
        }).catch(() => {})

        totalSent++
      }

      // Advance next_send
      const next = new Date(today)
      if (cycle.cadence === 'biweekly') next.setDate(next.getDate() + 14)
      else if (cycle.cadence === 'monthly') next.setDate(next.getDate() + 30)
      else next.setDate(next.getDate() + 7)

      await admin.from('survey_cycles').update({
        next_send: next.toISOString().slice(0, 10),
        last_sent: today,
      }).eq('id', cycle.id)
    }

    return new Response(
      JSON.stringify({ ok: true, cycles_processed: cycles?.length ?? 0, emails_sent: totalSent }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('send-surveys error:', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

// ── HTML email template ───────────────────────────────────────────────────────
function buildEmail(name: string, orgName: string, surveyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:white;">📊 TeamPulse</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">Hi ${name} 👋</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#6b7280;line-height:1.7;">
              Your <strong style="color:#111827;">pulse survey</strong> for
              <strong style="color:#111827;">${orgName}</strong> is ready.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
              It takes less than <strong style="color:#4f46e5;">2 minutes</strong> and your answers are
              <strong style="color:#4f46e5;">completely anonymous</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding-bottom:28px;">
                <a href="${surveyUrl}" style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;font-size:16px;font-weight:600;padding:14px 40px;border-radius:10px;">
                  Take the survey →
                </a>
              </td></tr>
            </table>
            <table cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #f3f4f6;padding-top:20px;">
              <tr>
                <td width="33%" align="center"><p style="margin:0;font-size:22px;">🔒</p><p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Anonymous</p></td>
                <td width="33%" align="center"><p style="margin:0;font-size:22px;">⏱️</p><p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Under 2 min</p></td>
                <td width="33%" align="center"><p style="margin:0;font-size:22px;">📈</p><p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Helps the team</p></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you're a member of <strong>${orgName}</strong> on TeamPulse.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
