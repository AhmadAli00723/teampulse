-- ============================================================
-- TeamPulse — Migration 02: Surveys
-- Run AFTER 01_foundation.sql
-- ============================================================

create table if not exists public.metric_types (
  id          text primary key,
  label       text not null,
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

create table if not exists public.question_library (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references public.organizations(id) on delete cascade,
  metric_id  text references public.metric_types(id),
  text       text not null,
  type       text not null default 'scale_10' check (type in ('scale_10','scale_5','text','nps')),
  is_builtin boolean default false
);

-- Built-in question seeds
insert into public.question_library (metric_id, text, type, is_builtin) values
  ('recognition',       'I feel appreciated for the work I do.',                      'scale_10', true),
  ('recognition',       'My contributions are recognized by my team.',                'scale_10', true),
  ('feedback',          'I receive useful feedback that helps me grow.',               'scale_10', true),
  ('feedback',          'I know what I need to do to improve my performance.',        'scale_10', true),
  ('happiness',         'I feel happy at work most days.',                             'scale_10', true),
  ('happiness',         'I look forward to coming to work.',                           'scale_10', true),
  ('wellness',          'I am able to maintain a healthy work-life balance.',          'scale_10', true),
  ('wellness',          'I rarely feel overwhelmed or burned out at work.',            'scale_10', true),
  ('personal_growth',   'I have opportunities to learn and grow in my role.',         'scale_10', true),
  ('personal_growth',   'My role challenges me in a positive way.',                   'scale_10', true),
  ('mgr_relationship',  'My manager genuinely cares about my wellbeing.',             'scale_10', true),
  ('mgr_relationship',  'My manager gives me the support I need to succeed.',         'scale_10', true),
  ('peer_relationship', 'I feel like I belong to a team.',                             'scale_10', true),
  ('peer_relationship', 'My team collaborates effectively.',                           'scale_10', true),
  ('alignment',         'I understand how my work contributes to company goals.',     'scale_10', true),
  ('alignment',         'I believe in the direction this company is heading.',        'scale_10', true),
  ('satisfaction',      'I am satisfied with my current role.',                        'scale_10', true),
  ('satisfaction',      'My job makes good use of my skills and abilities.',          'scale_10', true),
  ('ambassadorship',    'I am proud to tell people where I work.',                    'scale_10', true),
  ('ambassadorship',    'I would recommend this company as a great place to work.',   'scale_10', true),
  ('enps',              'On a scale of 0–10, how likely are you to recommend this company as a place to work?', 'scale_10', true)
on conflict do nothing;

create table if not exists public.survey_cycles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete cascade,
  cadence    text not null default 'weekly' check (cadence in ('weekly','biweekly','monthly')),
  active     boolean default true,
  metrics    text[] default '{}',
  next_send  date,
  created_at timestamptz default now()
);

create table if not exists public.survey_responses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete set null,
  cycle_id        uuid references public.survey_cycles(id) on delete set null,
  question_id     uuid references public.question_library(id),
  metric_id       text references public.metric_types(id),
  user_id         uuid not null references auth.users(id) on delete cascade,
  score           numeric,
  text_response   text,
  period_start    date not null,
  responded_at    timestamptz default now()
);

-- ---- RLS ----

alter table public.metric_types      enable row level security;
alter table public.question_library  enable row level security;
alter table public.survey_cycles     enable row level security;
alter table public.survey_responses  enable row level security;

create policy "anyone reads metric_types" on public.metric_types for select using (true);

create policy "read question_library" on public.question_library for select
  using (is_builtin = true or public.is_org_member(org_id));

create policy "read survey_cycles" on public.survey_cycles for select
  using (public.is_org_member(org_id));

create policy "manager writes survey_cycles" on public.survey_cycles for all
  using (public.is_manager_or_admin(org_id))
  with check (public.is_manager_or_admin(org_id));

-- CRITICAL: members can only access their own responses
create policy "own survey responses" on public.survey_responses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- Security-Definer Aggregate RPCs (managers call these) ----

create or replace function public.get_metric_scores(
  p_org_id  uuid,
  p_team_id uuid default null,
  p_period  date default current_date
)
returns table(metric_id text, avg_score numeric, response_count int, below_threshold boolean)
language plpgsql security definer stable as $$
declare v_threshold int := 4;
begin
  return query
  select
    r.metric_id,
    case when count(*) >= v_threshold then round(avg(r.score), 2) else null end,
    count(*)::int,
    (count(*) < v_threshold)::boolean
  from public.survey_responses r
  where r.org_id = p_org_id
    and (p_team_id is null or r.team_id = p_team_id)
    and r.period_start = date_trunc('week', p_period)::date
    and r.score is not null
    and r.metric_id != 'enps'
  group by r.metric_id;
end;
$$;

create or replace function public.get_enps(
  p_org_id  uuid,
  p_team_id uuid default null
)
returns table(enps numeric, promoters int, detractors int, passives int, total int, below_threshold boolean)
language plpgsql security definer stable as $$
declare v_threshold int := 4;
begin
  return query
  select
    case when count(*) >= v_threshold then
      round((count(*) filter (where score >= 9)::numeric - count(*) filter (where score <= 6)::numeric) / count(*)::numeric * 100, 1)
    else null end,
    count(*) filter (where score >= 9)::int,
    count(*) filter (where score <= 6)::int,
    count(*) filter (where score between 7 and 8)::int,
    count(*)::int,
    (count(*) < v_threshold)::boolean
  from public.survey_responses
  where org_id = p_org_id
    and (p_team_id is null or team_id = p_team_id)
    and metric_id = 'enps'
    and score is not null;
end;
$$;

create or replace function public.get_metric_trend(
  p_org_id    uuid,
  p_team_id   uuid default null,
  p_metric_id text default null,
  p_weeks     int default 12
)
returns table(period_start date, metric_id text, avg_score numeric, response_count int)
language plpgsql security definer stable as $$
declare v_threshold int := 4;
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
    and r.metric_id != 'enps'
  group by r.period_start, r.metric_id
  order by r.period_start;
end;
$$;
