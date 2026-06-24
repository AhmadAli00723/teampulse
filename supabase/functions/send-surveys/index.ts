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
    // Admin client — bypasses RLS so we can read all members and auth emails
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { org_id, force = false } = body as { org_id?: string; force?: boolean }

    const today      = new Date().toISOString().slice(0, 10)
    const APP_URL    = Deno.env.get('APP_URL')     ?? 'http://localhost:5173'
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL')  ?? 'TeamPulse <surveys@teampulse.app>'

    // ── 1. Find active cycles that are due ─────────────────────────────────────
    let q = admin
      .from('survey_cycles')
      .select('*, organizations(name)')
      .eq('active', true)

    // force=true skips the date check (used by "Send now" button in the UI)
    if (!force) q = (q as any).lte('next_send', today).not('next_send', 'is', null)
    if (org_id)  q = (q as any).eq('org_id', org_id)

    const { data: cycles, error: cycleErr } = await q
    if (cycleErr) throw new Error(cycleErr.message)

    let totalSent = 0

    for (const cycle of cycles ?? []) {
      // ── 2. Get all members of the org (or team if team-scoped) ──────────────
      let mq = admin
        .from('memberships')
        .select('user_id, full_name')
        .eq('org_id', cycle.org_id)
      if (cycle.team_id) mq = (mq as any).eq('team_id', cycle.team_id)

      const { data: members } = await mq

      for (const m of members ?? []) {
        // ── 3. Get the member's email via admin Auth API ─────────────────────
        const { data: { user } } = await admin.auth.admin.getUserById(m.user_id)
        if (!user?.email) continue

        const firstName  = (m.full_name ?? '').split(' ')[0] || 'there'
        const orgName    = (cycle as any).organizations?.name ?? 'your team'
        const surveyLink = `${APP_URL}/surveys/answer`

        // ── 4. Send the email via Resend ─────────────────────────────────────
        if (RESEND_KEY) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    FROM_EMAIL,
              to:      user.email,
              subject: `📊 Your ${orgName} pulse survey is ready`,
              html:    buildEmail(firstName, orgName, surveyLink),
            }),
          })
          if (!res.ok) {
            console.error(`Resend error for ${user.email}:`, await res.text())
            continue
          }
        } else {
          // No Resend key — log but don't fail (useful for local testing)
          console.log(`[DRY RUN] Would email ${user.email} �� ${surveyLink}`)
        }

        // ── 5. Log the send (non-fatal — table created in 07_integrations.sql) ─
        await admin.from('notification_log').insert({
          org_id:    cycle.org_id,
          type:      'survey_send',
          channel:   'email',
          recipient: user.email,
          success:   true,
        }).catch(() => {})

        totalSent++
      }

      // ── 6. Advance next_send by cadence and record last_sent ─────────────────
      const next = new Date(today)
      if (cycle.cadence === 'weekly')   next.setDate(next.getDate() + 7)
      if (cycle.cadence === 'biweekly') next.setDate(next.getDate() + 14)
      if (cycle.cadence === 'monthly')  next.setDate(next.getDate() + 30)

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

// ─── HTML email template ─────────────────────────────────────────���─────────────
function buildEmail(name: string, orgName: string, surveyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:white;letter-spacing:-0.01em;">📊 TeamPulse</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">
              Hi ${name} 👋
            </h1>
            <p style="margin:0 0 8px;font-size:15px;color:#6b7280;line-height:1.7;">
              Your <strong style="color:#111827;">pulse survey</strong> for
              <strong style="color:#111827;">${orgName}</strong> is ready.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
              It takes less than <strong style="color:#4f46e5;">2 minutes</strong> and your
              answers are <strong style="color:#4f46e5;">completely anonymous</strong> —
              your manager will never see your individual responses.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <a href="${surveyUrl}"
                     style="display:inline-block;background:#4f46e5;color:white;
                            text-decoration:none;font-size:16px;font-weight:600;
                            padding:14px 40px;border-radius:10px;letter-spacing:0.01em;">
                    Take the survey →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Trust badges -->
            <table cellpadding="0" cellspacing="0" width="100%"
                   style="border-top:1px solid #f3f4f6;padding-top:20px;">
              <tr>
                <td width="33%" align="center">
                  <p style="margin:0;font-size:22px;">🔒</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Anonymous</p>
                </td>
                <td width="33%" align="center">
                  <p style="margin:0;font-size:22px;">⏱️</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Under 2 min</p>
                </td>
                <td width="33%" align="center">
                  <p style="margin:0;font-size:22px;">📈</p>
                  <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-weight:500;">Helps the team</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you're a member of
              <strong>${orgName}</strong> on TeamPulse.
              Results are only shown to managers once 4+ team members have responded.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

