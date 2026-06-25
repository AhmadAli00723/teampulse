-- ============================================================
-- TeamPulse — Dummy Survey Data for Dashboard Testing
-- Run in Supabase SQL Editor
-- Inserts realistic responses for ALL metrics for ALL members
-- for the current week (period_start = June 22, 2026)
-- Skips any responses that already exist
-- ============================================================

do $$
declare
  v_org_id   uuid;
  v_period   date := '2026-06-22'; -- Monday of current ISO week (June 25, 2026)
  v_user     record;
  v_question record;
  v_score    numeric;

  -- Realistic score ranges per metric (to make dashboard look natural)
  type_scores int[][] := array[
    array[7,9],  -- recognition
    array[6,9],  -- feedback
    array[7,10], -- happiness
    array[5,8],  -- wellness (slightly lower - stress)
    array[6,9],  -- personal_growth
    array[7,10], -- mgr_relationship
    array[8,10], -- peer_relationship
    array[6,9],  -- alignment
    array[7,9],  -- satisfaction
    array[8,10], -- ambassadorship
    array[7,10]  -- enps
  ];

begin
  -- Get the org
  select id into v_org_id from public.organizations limit 1;

  if v_org_id is null then
    raise exception 'No organization found. Create one first.';
  end if;

  raise notice 'Inserting dummy responses for org: % | period: %', v_org_id, v_period;

  -- Loop over every member in the org
  for v_user in
    select user_id, team_id
    from public.memberships
    where org_id = v_org_id
  loop

    -- Loop over one built-in question per metric
    for v_question in
      select distinct on (metric_id)
        id,
        metric_id,
        type
      from public.question_library
      where is_builtin = true
      order by metric_id, id
    loop

      -- Generate a realistic score based on the metric
      v_score := (
        floor(random() * (
          case v_question.metric_id
            when 'recognition'       then 3  -- range 3
            when 'feedback'          then 4  -- range 4
            when 'happiness'         then 3
            when 'wellness'          then 4
            when 'personal_growth'   then 4
            when 'mgr_relationship'  then 3
            when 'peer_relationship' then 3
            when 'alignment'         then 4
            when 'satisfaction'      then 3
            when 'ambassadorship'    then 3
            when 'enps'              then 4  -- range 4 (6-10)
            else 4
          end
        )) + (
          case v_question.metric_id
            when 'recognition'       then 7  -- min 7
            when 'feedback'          then 6  -- min 6
            when 'happiness'         then 7
            when 'wellness'          then 5  -- min 5 (burnout risk)
            when 'personal_growth'   then 6
            when 'mgr_relationship'  then 7
            when 'peer_relationship' then 7
            when 'alignment'         then 6
            when 'satisfaction'      then 7
            when 'ambassadorship'    then 7
            when 'enps'              then 6  -- min 6
            else 6
          end
        )
      )::numeric;

      -- Insert only if this user hasn't answered this question this week
      insert into public.survey_responses (
        org_id,
        team_id,
        question_id,
        metric_id,
        user_id,
        score,
        period_start
      )
      select
        v_org_id,
        v_user.team_id,
        v_question.id,
        v_question.metric_id,
        v_user.user_id,
        v_score,
        v_period
      where not exists (
        select 1 from public.survey_responses
        where user_id     = v_user.user_id
          and question_id = v_question.id
          and period_start = v_period
      );

    end loop; -- questions
  end loop; -- members

  raise notice 'Done! Dashboard should now show scores for all metrics.';
end;
$$;

