-- ============================================================
-- TeamPulse — Migration 04: Recognition & Polls
-- Run AFTER 01_foundation.sql
-- ============================================================

create table if not exists public.recognitions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  giver_id    uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  message     text not null,
  value_tag   text,
  public      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  created_by uuid not null references auth.users(id),
  question   text not null,
  options    text[] not null,
  closes_at  timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  option_idx int not null,
  voted_at   timestamptz default now(),
  unique (poll_id, user_id)
);

-- ---- RLS ----

alter table public.recognitions enable row level security;
alter table public.polls        enable row level security;
alter table public.poll_votes   enable row level security;

create policy "org members read recognitions" on public.recognitions for select
  using (public.is_org_member(org_id));

create policy "org members create recognitions" on public.recognitions for insert
  with check (public.is_org_member(org_id) and giver_id = auth.uid());

create policy "org members read polls" on public.polls for select
  using (public.is_org_member(org_id));

create policy "managers create polls" on public.polls for insert
  with check (public.is_manager_or_admin(org_id));

create policy "org members vote" on public.poll_votes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.polls p where p.id = poll_id and public.is_org_member(p.org_id))
  );

create policy "org members read votes" on public.poll_votes for select
  using (
    exists (select 1 from public.polls p where p.id = poll_id and public.is_org_member(p.org_id))
  );
