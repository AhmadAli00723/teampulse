-- ============================================================
-- TeamPulse — Migration 09: Survey response uniqueness fix
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Add unique constraint so one user can only answer each question once per week
-- First remove any accidental duplicates that may already exist
delete from public.survey_responses a
using public.survey_responses b
where a.id > b.id
  and a.user_id      = b.user_id
  and a.question_id  = b.question_id
  and a.period_start = b.period_start;

-- Now add the constraint
alter table public.survey_responses
  drop constraint if exists survey_responses_user_question_period_unique;

alter table public.survey_responses
  add constraint survey_responses_user_question_period_unique
  unique (user_id, question_id, period_start);

-- ── 2. Fix get_metric_scores — count DISTINCT users not rows
-- This protects anonymity: 1 user can never fake the 4-person threshold
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
    case when count(distinct r.user_id) >= v_threshold
      then round(avg(r.score), 2)
      else null
    end,
    count(distinct r.user_id)::int,
    (count(distinct r.user_id) < v_threshold)::boolean
  from public.survey_responses r
  where r.org_id = p_org_id
    and (p_team_id is null or r.team_id = p_team_id)
    and r.period_start = date_trunc('week', p_period)::date
    and r.score is not null
    and r.metric_id != 'enps'
  group by r.metric_id;
end;
$$;

-- ── 3. Fix get_enps — count DISTINCT users
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
    case when count(distinct user_id) >= v_threshold then
      round(
        (count(distinct user_id) filter (where score >= 9)::numeric
        - count(distinct user_id) filter (where score <= 6)::numeric)
        / count(distinct user_id)::numeric * 100,
      1)
    else null end,
    count(distinct user_id) filter (where score >= 9)::int,
    count(distinct user_id) filter (where score <= 6)::int,
    count(distinct user_id) filter (where score between 7 and 8)::int,
    count(distinct user_id)::int,
    (count(distinct user_id) < v_threshold)::boolean
  from public.survey_responses
  where org_id = p_org_id
    and (p_team_id is null or team_id = p_team_id)
    and metric_id = 'enps'
    and score is not null;
end;
$$;

-- ── 4. Fix get_metric_trend — count DISTINCT users
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
    case when count(distinct r.user_id) >= v_threshold
      then round(avg(r.score), 2)
      else null
    end,
    count(distinct r.user_id)::int
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

