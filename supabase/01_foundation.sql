-- ============================================================
-- TeamPulse — Migration 01: Foundation (orgs, teams, memberships, invites)
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  created_at timestamptz default now()
);

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','manager','member')),
  full_name  text,
  avatar_url text,
  invited_by uuid references auth.users(id),
  joined_at  timestamptz default now(),
  unique (org_id, user_id)
);

create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  email      text not null,
  role       text not null default 'member' check (role in ('admin','manager','member')),
  token      text unique not null default gen_random_uuid()::text,
  invited_by uuid references auth.users(id),
  accepted   boolean default false,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- ---- RLS ----

alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

-- Helper functions
create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships where user_id = auth.uid() and org_id = p_org_id
  );
$$;

create or replace function public.is_manager_or_admin(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org_id and role in ('manager','admin')
  );
$$;

create or replace function public.is_admin(p_org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = p_org_id and role = 'admin'
  );
$$;

-- Organizations: any member can read their org
create policy "org members read" on public.organizations for select
  using (public.is_org_member(id));

create policy "org admin update" on public.organizations for update
  using (public.is_admin(id));

create policy "org insert" on public.organizations for insert
  with check (true);

-- Teams
create policy "team members read" on public.teams for select
  using (public.is_org_member(org_id));

create policy "manager create team" on public.teams for insert
  with check (public.is_manager_or_admin(org_id));

create policy "manager update team" on public.teams for update
  using (public.is_manager_or_admin(org_id));

-- Memberships
create policy "member reads own org memberships" on public.memberships for select
  using (public.is_org_member(org_id));

create policy "member insert own" on public.memberships for insert
  with check (user_id = auth.uid());

create policy "admin updates roles" on public.memberships for update
  using (public.is_admin(org_id));

-- Invites
create policy "admin creates invite" on public.invites for insert
  with check (public.is_manager_or_admin(org_id));

create policy "token read invite" on public.invites for select
  using (true);

create policy "accept invite update" on public.invites for update
  using (true);
