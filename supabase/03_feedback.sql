-- ============================================================
-- TeamPulse — Migration 03: Anonymous Feedback
-- Run AFTER 01_foundation.sql
-- ============================================================

create table if not exists public.feedback_threads (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  anon_token text unique not null default gen_random_uuid()::text,
  author_id  uuid not null references auth.users(id) on delete cascade,
  manager_id uuid references auth.users(id),
  subject    text,
  status     text default 'open' check (status in ('open','resolved')),
  created_at timestamptz default now()
);

create table if not exists public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.feedback_threads(id) on delete cascade,
  sender_role text not null check (sender_role in ('member','manager')),
  body        text not null,
  sent_at     timestamptz default now()
);

-- View for managers that strips author_id (CRITICAL for anonymity)
create or replace view public.feedback_threads_for_manager as
  select id, org_id, team_id, anon_token, manager_id, subject, status, created_at
  from public.feedback_threads
  where manager_id = auth.uid()
     or public.is_manager_or_admin(org_id);

-- ---- RLS ----

alter table public.feedback_threads  enable row level security;
alter table public.feedback_messages enable row level security;

-- Authors read/write their own threads
create policy "author owns thread" on public.feedback_threads for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Managers read threads assigned to them (never see author_id — use the view)
create policy "manager reads assigned" on public.feedback_threads for select
  using (manager_id = auth.uid() or public.is_manager_or_admin(org_id));

-- Messages: thread participants can read/write
create policy "thread participants read messages" on public.feedback_messages for select
  using (
    exists (
      select 1 from public.feedback_threads t
      where t.id = thread_id
        and (t.author_id = auth.uid() or t.manager_id = auth.uid() or public.is_manager_or_admin(t.org_id))
    )
  );

create policy "thread participants write messages" on public.feedback_messages for insert
  with check (
    exists (
      select 1 from public.feedback_threads t
      where t.id = thread_id
        and (t.author_id = auth.uid() or t.manager_id = auth.uid() or public.is_manager_or_admin(t.org_id))
    )
  );
