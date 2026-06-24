# TeamPulse — Full Officevibe Clone Specification

> This document is the single source of truth for building **TeamPulse**, a full-featured
> employee-engagement platform modelled on Workleap Officevibe.
> Any AI model or developer can pick up this file and continue building from the current state.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema (full)](#5-database-schema-full)
6. [Row-Level Security Rules](#6-row-level-security-rules)
7. [Security-Definer RPCs](#7-security-definer-rpcs)
8. [Feature Phases](#8-feature-phases)
   - [Phase 1 — Auth & Tenancy](#phase-1--auth--tenancy)
   - [Phase 2 — Pulse Surveys & eNPS](#phase-2--pulse-surveys--enps)
   - [Phase 3 — Manager Analytics Dashboard](#phase-3--manager-analytics-dashboard)
   - [Phase 4 — Anonymous Two-Way Feedback](#phase-4--anonymous-two-way-feedback)
   - [Phase 5 — Recognition & Custom Polls](#phase-5--recognition--custom-polls)
   - [Phase 6 — 1-on-1s & Goals/OKRs](#phase-6--1-on-1s--goalsokrs)
   - [Phase 7 — Advanced Reports & Integrations](#phase-7--advanced-reports--integrations)
9. [UI / Design Guidelines](#9-ui--design-guidelines)
10. [Routing Map](#10-routing-map)
11. [Key Invariants & Rules](#11-key-invariants--rules)
12. [Current Build Status](#12-current-build-status)

---

## 1. Project Overview

**TeamPulse** is a multi-tenant SaaS platform that helps managers and HR teams continuously
measure and improve employee engagement through:

- Recurring anonymous pulse surveys across 10 engagement metrics
- Employee Net Promoter Score (eNPS)
- Anonymous two-way feedback threads
- Peer-to-peer recognition ("Good Vibes")
- Custom one-off polls
- 1-on-1 meeting agendas & action items
- Goals / OKRs with progress tracking
- Analytics dashboards with threshold-gated aggregates (to protect anonymity)
- Scheduled survey delivery via email and Slack

**Project location:** `c:\teampulse`  
**Sibling project for stack reference:** `c:\voice-diary` (Vite + React + Supabase)

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend framework | React 18 + Vite 5 |
| Routing | react-router-dom v6 |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Supabase client | @supabase/supabase-js v2 |
| Date utilities | date-fns |
| Icons | lucide-react |
| Email (Phase 7) | Resend |
| Slack (Phase 7) | Slack Web API / Incoming Webhooks |
| Scheduling (Phase 7) | Supabase Edge Functions + pg_cron |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Deployment | Vercel (or Netlify — same pattern as voice-diary) |

**Node / npm:** whatever is installed on the machine.  
**Supabase:** a brand-new, separate Supabase project (not the voice-diary one).

---

## 3. Folder Structure

```
c:\teampulse\
├── public\
├── src\
│   ├── App.jsx                  # Root with router + auth gate
│   ├── main.jsx
│   ├── styles.css               # Tailwind directives
│   ├── lib\
│   │   ├── supabase.js          # createClient (reads env vars)
│   │   └── constants.js         # ENGAGEMENT_METRICS, CADENCE options, thresholds
│   ├── hooks\
│   │   ├── useAuth.js
│   │   ├── useOrg.js
│   │   └── useTeam.js
│   ├── components\
│   │   ├── Layout.jsx           # Sidebar + topbar shell
│   │   ├── ProtectedRoute.jsx
│   │   └── ui\                  # Reusable primitives (Button, Card, Badge, Modal…)
│   └── pages\
│       ├── auth\
│       │   ├── Login.jsx
│       │   ├── Signup.jsx
│       │   └── AcceptInvite.jsx
│       ├── onboarding\
│       │   └── CreateOrg.jsx
│       ├── dashboard\
│       │   └── Dashboard.jsx    # Manager analytics home
│       ├── surveys\
│       │   ├── AnswerSurvey.jsx # Member-facing survey UI
│       │   └── SurveySettings.jsx
│       ├── feedback\
│       │   ├── FeedbackInbox.jsx
│       │   └── SubmitFeedback.jsx
│       ├── recognition\
│       │   └── Recognition.jsx
│       ├── polls\
│       │   └── Polls.jsx
│       ├── one_on_ones\
│       │   └── OneOnOnes.jsx
│       ├── goals\
│       │   └── Goals.jsx
│       ├── reports\
│       │   └── Reports.jsx
│       └── settings\
│           ├── OrgSettings.jsx
│           ├── TeamSettings.jsx
│           └── Members.jsx
├── supabase\
│   ├── 01_foundation.sql        # orgs, teams, memberships
│   ├── 02_surveys.sql           # survey_cycles, questions, responses, RPCs
│   ├── 03_feedback.sql          # feedback_threads, feedback_messages
│   ├── 04_recognition.sql       # recognitions, polls, poll_votes
│   ├── 05_one_on_ones.sql       # one_on_ones, oo_items
│   ├── 06_goals.sql             # goals, key_results
│   └── 07_integrations.sql      # integration_settings, notification_log
├── .env                         # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── SPEC.md                      # THIS FILE
```

---

## 4. Environment Variables

```env
# .env (never commit the real values)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Used only in Edge Functions / server-side scripts (Phase 7)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY
RESEND_API_KEY=re_xxxx
SLACK_BOT_TOKEN=xoxb-xxxx
```

---

## 5. Database Schema (full)

Run each SQL file in order in the Supabase SQL editor.

### `supabase/01_foundation.sql`

```sql
-- Organizations
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  created_at  timestamptz default now()
);

-- Teams within an organization
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

-- Memberships: links auth.users to orgs and optionally a team
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin','manager','member')),
  full_name   text,
  avatar_url  text,
  invited_by  uuid references auth.users(id),
  joined_at   timestamptz default now(),
  unique (org_id, user_id)
);

-- Invites (before user signs up)
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  email       text not null,
  role        text not null default 'member' check (role in ('admin','manager','member')),
  token       text unique not null default gen_random_uuid()::text,
  invited_by  uuid references auth.users(id),
  accepted    boolean default false,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);
```

### `supabase/02_surveys.sql`

```sql
-- Master list of engagement metrics
create table if not exists public.metric_types (
  id    text primary key,  -- e.g. 'recognition', 'happiness', 'enps'
  label text not null,
  description text
);

insert into public.metric_types (id, label, description) values
  ('recognition',        'Recognition',               'Do employees feel appreciated?'),
  ('feedback',           'Feedback',                  'Are employees getting useful feedback?'),
  ('happiness',          'Happiness',                 'General sentiment about work'),
  ('wellness',           'Wellness',                  'Balance, stress, and burnout'),
  ('personal_growth',    'Personal Growth',           'Learning and career development'),
  ('mgr_relationship',   'Relationship with Manager', 'Trust and support from manager'),
  ('peer_relationship',  'Relationship with Peers',   'Team collaboration and belonging'),
  ('alignment',          'Alignment',                 'Connection to company mission'),
  ('satisfaction',       'Job Satisfaction',          'Fulfilment in the role'),
  ('ambassadorship',     'Ambassadorship',            'Pride and willingness to recommend company'),
  ('enps',               'eNPS',                      'Employee Net Promoter Score')
on conflict (id) do nothing;

-- Survey question library
create table if not exists public.question_library (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,  -- null = built-in
  metric_id   text references public.metric_types(id),
  text        text not null,
  type        text not null default 'scale_10' check (type in ('scale_10','scale_5','text','nps')),
  is_builtin  boolean default false
);

-- Survey cycles (recurring schedules per org/team)
create table if not exists public.survey_cycles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete cascade,  -- null = all teams
  cadence     text not null default 'weekly' check (cadence in ('weekly','biweekly','monthly')),
  active      boolean default true,
  metrics     text[] default '{}',  -- subset of metric_type ids; empty = all
  next_send   date,
  created_at  timestamptz default now()
);

-- Survey responses (raw — RLS: author only)
create table if not exists public.survey_responses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  team_id       uuid references public.teams(id) on delete set null,
  cycle_id      uuid references public.survey_cycles(id) on delete set null,
  question_id   uuid references public.question_library(id),
  metric_id     text references public.metric_types(id),
  user_id       uuid not null references auth.users(id) on delete cascade,
  score         numeric,          -- null for text responses
  text_response text,
  period_start  date not null,
  responded_at  timestamptz default now()
);
```

### `supabase/03_feedback.sql`

```sql
-- Anonymous feedback threads
create table if not exists public.feedback_threads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  team_id       uuid references public.teams(id) on delete set null,
  anon_token    text unique not null default gen_random_uuid()::text,
  author_id     uuid not null references auth.users(id) on delete cascade,  -- never exposed to manager
  manager_id    uuid references auth.users(id),
  subject       text,
  status        text default 'open' check (status in ('open','resolved')),
  created_at    timestamptz default now()
);

-- Messages in a feedback thread
create table if not exists public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.feedback_threads(id) on delete cascade,
  sender_role text not null check (sender_role in ('member','manager')),
  body        text not null,
  sent_at     timestamptz default now()
);
```

### `supabase/04_recognition.sql`

```sql
-- Peer recognition ("Good Vibes")
create table if not exists public.recognitions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  giver_id      uuid not null references auth.users(id) on delete cascade,
  receiver_id   uuid not null references auth.users(id) on delete cascade,
  message       text not null,
  value_tag     text,  -- e.g. 'teamwork', 'innovation', 'customer-focus'
  public        boolean default true,
  created_at    timestamptz default now()
);

-- Custom one-off polls
create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  created_by  uuid not null references auth.users(id),
  question    text not null,
  options     text[] not null,
  closes_at   timestamptz,
  created_at  timestamptz default now()
);

create table if not exists public.poll_votes (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  option_idx  int not null,
  voted_at    timestamptz default now(),
  unique (poll_id, user_id)
);
```

### `supabase/05_one_on_ones.sql`

```sql
create table if not exists public.one_on_ones (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  manager_id    uuid not null references auth.users(id),
  member_id     uuid not null references auth.users(id),
  scheduled_at  timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

create table if not exists public.oo_items (
  id          uuid primary key default gen_random_uuid(),
  oo_id       uuid not null references public.one_on_ones(id) on delete cascade,
  type        text default 'agenda' check (type in ('agenda','action')),
  text        text not null,
  done        boolean default false,
  created_at  timestamptz default now()
);
```

### `supabase/06_goals.sql`

```sql
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  owner_id    uuid not null references auth.users(id),
  title       text not null,
  description text,
  due_date    date,
  status      text default 'on_track' check (status in ('on_track','at_risk','off_track','complete')),
  created_at  timestamptz default now()
);

create table if not exists public.key_results (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals(id) on delete cascade,
  title       text not null,
  target      numeric,
  current     numeric default 0,
  unit        text,
  done        boolean default false
);
```

### `supabase/07_integrations.sql`

```sql
create table if not exists public.integration_settings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade unique,
  slack_webhook_url   text,
  slack_channel       text,
  email_from          text,
  notify_survey_send  boolean default true,
  notify_recognition  boolean default true,
  updated_at          timestamptz default now()
);

create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  type        text,   -- 'survey_send', 'reminder', 'recognition'
  channel     text,   -- 'email', 'slack'
  recipient   text,
  sent_at     timestamptz default now(),
  success     boolean
);
```

---

## 6. Row-Level Security Rules

Enable RLS on every table. The pattern below should be applied to all tables
(adjust `org_id` / `user_id` references per table).

```sql
-- Helper: get current user's org_id and role
create or replace function public.current_membership()
returns table(org_id uuid, team_id uuid, role text)
language sql security definer stable as $$
  select org_id, team_id, role
  from public.memberships
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_manager_or_admin(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id = p_org_id
      and role in ('manager','admin')
  );
$$;
```

### Critical anonymity rule for `survey_responses`

```sql
alter table public.survey_responses enable row level security;

-- Members can only read/write their own responses
create policy "own responses" on public.survey_responses
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Managers CANNOT read raw rows — they use RPCs only
-- (No manager SELECT policy is created)
```

### `feedback_threads` — manager sees thread but never `author_id`

```sql
alter table public.feedback_threads enable row level security;

-- Author can see their own threads
create policy "author reads own threads" on public.feedback_threads
  for select using (author_id = auth.uid());

-- Manager sees threads where they are the assigned manager (author_id column excluded via view)
create policy "manager reads assigned threads" on public.feedback_threads
  for select using (manager_id = auth.uid());
```

Create a view for managers that strips `author_id`:

```sql
create or replace view public.feedback_threads_for_manager as
  select id, org_id, team_id, anon_token, manager_id, subject, status, created_at
  from public.feedback_threads
  where manager_id = auth.uid();
```

---

## 7. Security-Definer RPCs

Managers access survey data only through these functions. They aggregate and enforce a
minimum response threshold before returning data (default: 4 responses).

```sql
-- Returns metric scores for a team, only if enough responses exist
create or replace function public.get_metric_scores(
  p_org_id    uuid,
  p_team_id   uuid default null,
  p_period    date default current_date
)
returns table(metric_id text, avg_score numeric, response_count int, below_threshold boolean)
language plpgsql security definer stable as $$
declare
  v_threshold int := 4;
begin
  return query
  select
    r.metric_id,
    case when count(*) >= v_threshold then round(avg(r.score), 2) else null end as avg_score,
    count(*)::int as response_count,
    count(*) < v_threshold as below_threshold
  from public.survey_responses r
  where r.org_id = p_org_id
    and (p_team_id is null or r.team_id = p_team_id)
    and r.period_start = date_trunc('week', p_period)::date
    and r.score is not null
  group by r.metric_id;
end;
$$;

-- eNPS: promoters (9-10) minus detractors (0-6), threshold-gated
create or replace function public.get_enps(
  p_org_id   uuid,
  p_team_id  uuid default null
)
returns table(enps numeric, promoters int, detractors int, passives int, total int, below_threshold boolean)
language plpgsql security definer stable as $$
declare
  v_threshold int := 4;
begin
  return query
  select
    case when count(*) >= v_threshold
      then round(
        (count(*) filter (where score >= 9)::numeric - count(*) filter (where score <= 6)::numeric)
        / count(*)::numeric * 100, 1)
      else null end as enps,
    count(*) filter (where score >= 9)::int as promoters,
    count(*) filter (where score <= 6)::int as detractors,
    count(*) filter (where score between 7 and 8)::int as passives,
    count(*)::int as total,
    count(*) < v_threshold as below_threshold
  from public.survey_responses
  where org_id = p_org_id
    and (p_team_id is null or team_id = p_team_id)
    and metric_id = 'enps'
    and score is not null;
end;
$$;

-- Trend: scores per metric over past N weeks
create or replace function public.get_metric_trend(
  p_org_id    uuid,
  p_team_id   uuid default null,
  p_metric_id text default null,
  p_weeks     int default 12
)
returns table(period_start date, metric_id text, avg_score numeric, response_count int)
language plpgsql security definer stable as $$
declare
  v_threshold int := 4;
begin
  return query
  select
    r.period_start,
    r.metric_id,
    case when count(*) >= v_threshold then round(avg(r.score), 2) else null end,
    count(*)::int
  from public.survey_responses r
  where r.org_id = p_org_id
    and (p_team_id is null or r.team_id = p_team_id)
    and (p_metric_id is null or r.metric_id = p_metric_id)
    and r.period_start >= (current_date - (p_weeks * 7))::date
    and r.score is not null
  group by r.period_start, r.metric_id
  order by r.period_start;
end;
$$;
```

---

## 8. Feature Phases

### Phase 1 — Auth & Tenancy

**Goal:** A working app where users can sign up, create an org, invite people, assign roles, and manage teams.

**SQL files to run:** `supabase/01_foundation.sql` + RLS + helper functions.

**Screens to build:**
- `/login` — email/password login via `supabase.auth.signInWithPassword`
- `/signup` — registration; on first sign-in triggers onboarding
- `/onboarding` — "Create your organization" form (name, slug)
- `/settings/members` — invite by email, list members, change roles
- `/settings/teams` — create/rename teams, assign members

**Key logic:**
- After sign-up, check if user has a membership row. If not → redirect to `/onboarding`.
- Invite flow: POST to a Supabase Edge Function (or client-side) that inserts an invite row and sends an email link to `/accept-invite?token=xxx`.
- `/accept-invite` reads the token, creates a membership, marks invite accepted.

---

### Phase 2 — Pulse Surveys & eNPS

**Goal:** The recurring engine that sends short surveys and collects anonymous scores.

**SQL files to run:** `supabase/02_surveys.sql` + anonymity RLS.

**Screens to build:**
- `/surveys/answer` — member-facing card-by-card survey UI (scale sliders + optional text)
- `/settings/surveys` — manager: turn metrics on/off, set cadence (weekly/biweekly/monthly)

**Key logic:**
- Built-in question library (seed 2–3 questions per metric in `question_library` with `is_builtin = true, org_id = null`).
- `survey_cycles` row determines which metrics and cadence apply to a team.
- On survey open, generate one question per enabled metric from the library (random or round-robin).
- Responses written to `survey_responses` with `user_id = auth.uid()` — no manager can read them directly.
- `period_start` = Monday of the current ISO week (so responses are grouped by week).

**eNPS question:** scale 0–10 "How likely are you to recommend [org name] as a place to work?" with metric_id = 'enps'.

---

### Phase 3 — Manager Analytics Dashboard

**Goal:** Aggregated, threshold-gated engagement scores visible only to managers/admins.

**Screens to build:**
- `/dashboard` — main analytics home for managers
  - Overall engagement score (average of all metric averages)
  - Per-metric score cards with trend arrows
  - eNPS gauge
  - Participation rate (responders / total members)
  - Team filter dropdown

**Charts (via Recharts):**
- `LineChart` for trend over 12 weeks per metric
- `RadarChart` for overall metric shape
- eNPS waterfall / gauge

**Key logic:**
- All data fetched via RPC `get_metric_scores`, `get_enps`, `get_metric_trend`.
- If `below_threshold = true`, show "Not enough responses" instead of a number.
- Members who visit `/dashboard` are redirected to `/surveys/answer`.

---

### Phase 4 — Anonymous Two-Way Feedback

**Goal:** Employees send honest anonymous messages; manager replies without learning their identity.

**SQL files to run:** `supabase/03_feedback.sql` + RLS + manager view.

**Screens to build:**
- `/feedback/submit` (member) — form to write feedback, optionally assign to a manager
- `/feedback/inbox` (manager) — list of threads (no author shown), reply UI

**Key logic:**
- On submit, generate a `feedback_threads` row with `anon_token`, `author_id` (hidden from manager), `manager_id`.
- Manager reads threads via the `feedback_threads_for_manager` VIEW (which excludes `author_id`).
- RLS on `feedback_messages`: member can read/write messages on their own threads; manager can read/write messages on threads where `manager_id = auth.uid()`.
- UI: both sides see a chat-style thread; member side shows their own identity, manager side shows "Anonymous".

---

### Phase 5 — Recognition & Custom Polls

**Goal:** Peer praise feed and manager-created polls.

**SQL files to run:** `supabase/04_recognition.sql` + RLS.

**Screens to build:**
- `/recognition` — feed of public recognitions, button to "Send a Good Vibe", value tag selector
- `/polls` — list open polls, vote, see results (bar chart); manager can create polls

**Key logic:**
- Recognitions are public within the org; RLS: org members can read all public recognitions.
- Poll votes are unique per user per poll (enforced by DB unique constraint).
- Poll results: managers see counts per option; members see results only after voting.

---

### Phase 6 — 1-on-1s & Goals/OKRs

**Goal:** Structured manager–member meetings and team goals.

**SQL files to run:** `supabase/05_one_on_ones.sql` + `supabase/06_goals.sql` + RLS.

**Screens to build:**
- `/1on1s` — list of 1-on-1 sessions; create new, add agenda items, mark action items done
- `/goals` — goal board (kanban or list by status); create goal, add key results, update progress

**Key logic:**
- 1-on-1 rows are shared between manager and member (RLS: either party can read/write).
- Goals visibility: team members can read team goals; only owner/manager can update.
- Progress % on a goal is derived from key results: `sum(current) / sum(target) * 100`.

---

### Phase 7 — Advanced Reports & Integrations

**Goal:** Exportable reports, benchmark comparisons, automated survey delivery, email + Slack notifications.

**SQL files to run:** `supabase/07_integrations.sql`.

**Edge Functions to build (in `supabase/functions/`):**
- `send-surveys` — triggered by `pg_cron` weekly; finds active cycles with `next_send <= now()`, emails or Slacks each member a survey link, updates `next_send`.
- `send-reminders` — 2 days after send, nudge non-responders.
- `send-recognition-slack` — posts a recognition to the org Slack channel when a new row is inserted.

**Screens to build:**
- `/reports` — manager selects date range + team, sees aggregated report, "Export CSV" and "Export PDF" buttons
- `/settings/integrations` — paste Slack webhook URL, configure Resend email from address

**Benchmarks:** store a static JSON of industry-average scores per metric; compare team score to the benchmark with a simple delta badge on the dashboard.

---

## 9. UI / Design Guidelines

- **Color palette:** indigo / violet primary (`indigo-600`), neutral grays (`gray-50` bg, `gray-900` text), green for positive, red for negative/alert.
- **Layout:** fixed left sidebar (200px) with nav icons + labels; top bar with org switcher + user avatar dropdown.
- **Cards:** white background, `rounded-2xl`, `shadow-sm`, `border border-gray-100`.
- **Scores:** display as a number out of 10 with a colored progress arc (SVG or Recharts `RadialBarChart`).
- **Mobile:** the member-facing survey answer page must be fully mobile-responsive (full-screen card swipe).
- **Empty states:** always show a friendly empty state illustration + CTA button, never a blank page.
- **Threshold guard:** when data is hidden due to threshold, show a lock icon + "At least 4 responses needed to display results."

---

## 10. Routing Map

```
/                       → redirect to /dashboard or /surveys/answer based on role
/login
/signup
/accept-invite          ?token=xxx
/onboarding             create org (first-time only)

/dashboard              manager: analytics home
/surveys/answer         member: current open survey
/settings/surveys       manager: cadence + metrics config

/feedback/submit        member
/feedback/inbox         manager

/recognition            all roles
/polls                  all roles

/1on1s                  manager + member
/goals                  all roles

/reports                manager + admin
/settings/org           admin
/settings/teams         admin / manager
/settings/members       admin
/settings/integrations  admin
```

---

## 11. Key Invariants & Rules

1. **Anonymity is inviolable.** Managers MUST never have a direct `SELECT` policy on `survey_responses`. All aggregate access goes through security-definer RPCs.
2. **Threshold before data.** No score is shown to a manager unless >= 4 responses exist for that metric in that period. This is enforced in SQL, not just the UI.
3. **author_id is never sent to the manager client.** The `feedback_threads_for_manager` view excludes it. The frontend must never fetch threads from the raw table as a manager.
4. **Multi-tenant isolation.** Every query includes `org_id` filtering. RLS policies enforce `org_id = (select org_id from memberships where user_id = auth.uid())`.
5. **Invite-only org joining.** Users cannot self-join an org. They must receive an invite token.
6. **Role hierarchy.** `admin` > `manager` > `member`. Admins can do everything managers can, plus org settings and billing.
7. **period_start is always the Monday of the ISO week.** Compute with `date_trunc('week', now())::date` in Postgres or `startOfISOWeek(new Date())` with date-fns on the client.

---

## 12. Current Build Status

| Phase | Status | Notes |
|-------|--------|-------|
| SPEC.md written | Done | This file |
| Phase 1 — Auth & Tenancy | Done | Full scaffold: auth, onboarding, orgs, members, invites, RLS |
| Phase 2 — Surveys | Done | Question library, survey cycles, anonymous responses, eNPS, RPCs |
| Phase 3 — Dashboard | Done | Metric scores, radar chart, trend lines, eNPS, threshold guard |
| Phase 4 — Feedback | Done | Anonymous submit + manager inbox with chat-style threads |
| Phase 5 — Recognition & Polls | Done | Good Vibes feed + custom polls with voting |
| Phase 6 — 1-on-1s & Goals | Done | 1-on-1 sessions with agenda/action items + OKR goals board |
| Phase 7 — Reports & Integrations | Not started | CSV export stub in Reports.jsx; full Slack/email/Edge Functions pending |

---

*Last updated: 2026-06-24. Update the "Current Build Status" table as each phase is completed.*
