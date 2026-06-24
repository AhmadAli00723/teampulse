-- ============================================================
-- TeamPulse — Migration 05: 1-on-1s
-- Run AFTER 01_foundation.sql
-- ============================================================

create table if not exists public.one_on_ones (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  manager_id   uuid not null references auth.users(id),
  member_id    uuid not null references auth.users(id),
  scheduled_at timestamptz,
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists public.oo_items (
  id         uuid primary key default gen_random_uuid(),
  oo_id      uuid not null references public.one_on_ones(id) on delete cascade,
  type       text default 'agenda' check (type in ('agenda','action')),
  text       text not null,
  done       boolean default false,
  created_at timestamptz default now()
);

-- ---- RLS ----

alter table public.one_on_ones enable row level security;
alter table public.oo_items    enable row level security;

create policy "1on1 participants" on public.one_on_ones for all
  using (manager_id = auth.uid() or member_id = auth.uid())
  with check (manager_id = auth.uid() or member_id = auth.uid());

create policy "oo_items participants" on public.oo_items for all
  using (
    exists (
      select 1 from public.one_on_ones o
      where o.id = oo_id and (o.manager_id = auth.uid() or o.member_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.one_on_ones o
      where o.id = oo_id and (o.manager_id = auth.uid() or o.member_id = auth.uid())
    )
  );
