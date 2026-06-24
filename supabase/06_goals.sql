-- ============================================================
-- TeamPulse — Migration 06: Goals & OKRs
-- Run AFTER 01_foundation.sql
-- ============================================================

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
  id      uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  title   text not null,
  target  numeric,
  current numeric default 0,
  unit    text,
  done    boolean default false
);

-- ---- RLS ----

alter table public.goals       enable row level security;
alter table public.key_results enable row level security;

create policy "org members read goals" on public.goals for select
  using (public.is_org_member(org_id));

create policy "org members create goals" on public.goals for insert
  with check (public.is_org_member(org_id) and owner_id = auth.uid());

create policy "owner or manager update goal" on public.goals for update
  using (owner_id = auth.uid() or public.is_manager_or_admin(org_id));

create policy "org members read key_results" on public.key_results for select
  using (
    exists (select 1 from public.goals g where g.id = goal_id and public.is_org_member(g.org_id))
  );

create policy "owner updates key_results" on public.key_results for all
  using (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and (g.owner_id = auth.uid() or public.is_manager_or_admin(g.org_id))
    )
  )
  with check (
    exists (
      select 1 from public.goals g
      where g.id = goal_id and (g.owner_id = auth.uid() or public.is_manager_or_admin(g.org_id))
    )
  );
