-- ============================================================
-- TeamPulse — Migration 07: Integrations & Scheduling
-- Run AFTER 06_goals.sql in the Supabase SQL Editor
-- ============================================================

-- Track when each cycle was last sent (needed by the edge function + UI)
alter table public.survey_cycles
  add column if not exists last_sent date;

-- ── Notification log ──────────────────────────────────────────────────────────
-- Records every email / Slack send for audit and debugging
create table if not exists public.notification_log (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations(id) on delete cascade,
  type      text,       -- 'survey_send' | 'reminder' | 'recognition'
  channel   text,       -- 'email' | 'slack'
  recipient text,
  sent_at   timestamptz default now(),
  success   boolean
);

-- ── Integration settings ──────────────────────────────────────────────────────
create table if not exists public.integration_settings (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade unique,
  slack_webhook_url   text,
  slack_channel       text,
  email_from          text,
  notify_survey_send  boolean default true,
  notify_recognition  boolean default true,
  updated_at          timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.notification_log      enable row level security;
alter table public.integration_settings  enable row level security;

-- Managers can read the notification log for their org
create policy "manager reads notification_log" on public.notification_log
  for select using (public.is_manager_or_admin(org_id));

-- Only admins can manage integration settings
create policy "admin manages integration_settings" on public.integration_settings
  for all
  using  (public.is_admin(org_id))
  with check (public.is_admin(org_id));

create policy "member reads integration_settings" on public.integration_settings
  for select using (public.is_org_member(org_id));


-- ============================================================
-- pg_cron setup — automatic daily survey scheduling
-- Run these two blocks SEPARATELY, in order, in the SQL Editor
-- ============================================================

-- BLOCK 1 ─ Enable the pg_cron extension (run this first, alone)
--
--   create extension if not exists pg_cron schema extensions;
--
-- Then REFRESH the page and run Block 2.


-- BLOCK 2 ─ Create the daily cron job (runs every day at 09:00 UTC)
--   Replace the two placeholders with your real values from:
--   Supabase Dashboard → Project Settings → API
--
--   YOUR_PROJECT_URL      → e.g. https://abcdefghijkl.supabase.co
--   YOUR_SERVICE_ROLE_KEY → the service_role secret (not the anon key!)
--
-- select cron.schedule(
--   'teampulse-send-surveys',   -- job name (unique)
--   '0 9 * * *',                -- cron expression: 09:00 UTC every day
--   $$
--   select net.http_post(
--     url     := 'YOUR_PROJECT_URL/functions/v1/send-surveys',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- To verify the job was created:
--   select * from cron.job;
--
-- To remove it:
--   select cron.unschedule('teampulse-send-surveys');

