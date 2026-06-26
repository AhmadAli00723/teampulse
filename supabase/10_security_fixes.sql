-- ============================================================
-- TeamPulse — Migration 10: Security fixes (RLS hardening)
-- Run in the Supabase SQL Editor AFTER all previous migrations.
--
-- Fixes two confirmed vulnerabilities found during QA:
--   C2. Feedback anonymity leak — managers could read author_id from
--       the base feedback_threads table (RLS is row-level, not column-level,
--       so the manager SELECT policy exposed the hidden author_id column).
--   C3. Privilege escalation — the "member insert own" policy let ANY
--       authenticated user insert a membership into ANY org as ANY role
--       (e.g. admin), bypassing the invite-only rule.
-- ============================================================


-- ── C3. Lock down memberships inserts ──────────────────────────────────────────
-- Org creation (create_organization) and invite acceptance (accept_invite) are
-- SECURITY DEFINER functions that bypass RLS, so no client-side INSERT policy is
-- needed. Removing the open policy closes the self-join / self-promote hole.

drop policy if exists "member insert own" on public.memberships;

-- (Optional belt-and-suspenders: also require a WITH CHECK on role changes so an
--  admin can't move a membership to another org.)
drop policy if exists "admin updates roles" on public.memberships;
create policy "admin updates roles" on public.memberships for update
  using  (public.is_admin(org_id))
  with check (public.is_admin(org_id));


-- ── C2. Stop managers from reading author_id on feedback_threads ────────────────
-- Managers must read threads ONLY through the feedback_threads_for_manager view,
-- which projects away author_id. RLS cannot hide a single column, so the manager
-- SELECT policy on the base table is removed entirely. The author keeps full
-- access to their own threads.

drop policy if exists "manager reads assigned" on public.feedback_threads;
-- "author owns thread" (FOR ALL using author_id = auth.uid()) stays as-is.

-- The view runs with the definer's rights and bypasses base-table RLS, so it keeps
-- working for managers. Make the filter explicit and safe:
create or replace view public.feedback_threads_for_manager as
  select id, org_id, team_id, anon_token, manager_id, subject, status, created_at
  from public.feedback_threads
  where manager_id = auth.uid()
     or public.is_manager_or_admin(org_id);


-- ── C2 (cont.) Keep manager message access working without base-table SELECT ────
-- The feedback_messages policies used EXISTS(... from feedback_threads ...), which
-- is now blocked by RLS for managers. Replace that check with a SECURITY DEFINER
-- helper that bypasses RLS and answers "can the current user access this thread?"

create or replace function public.can_access_thread(p_thread_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.feedback_threads t
    where t.id = p_thread_id
      and (
        t.author_id = auth.uid()
        or t.manager_id = auth.uid()
        or public.is_manager_or_admin(t.org_id)
      )
  );
$$;

drop policy if exists "thread participants read messages"  on public.feedback_messages;
drop policy if exists "thread participants write messages" on public.feedback_messages;

create policy "thread participants read messages" on public.feedback_messages for select
  using (public.can_access_thread(thread_id));

create policy "thread participants write messages" on public.feedback_messages for insert
  with check (public.can_access_thread(thread_id));


-- ── M3. Admin management: allow removing members and revoking invites ───────────
-- The UI now exposes "remove member" and "revoke invite"; these need DELETE policies.

drop policy if exists "admin deletes memberships" on public.memberships;
create policy "admin deletes memberships" on public.memberships for delete
  using (public.is_admin(org_id));

drop policy if exists "manager deletes invites" on public.invites;
create policy "manager deletes invites" on public.invites for delete
  using (public.is_manager_or_admin(org_id));


-- ── Verify ──────────────────────────────────────────────────────────────────────
-- After running, confirm a manager CANNOT read author_id directly:
--   select author_id from public.feedback_threads;   -- should return 0 rows for a manager
--   select * from public.feedback_threads_for_manager; -- should return threads, no author_id column
