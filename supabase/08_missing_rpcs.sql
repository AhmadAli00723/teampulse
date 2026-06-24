-- ============================================================
-- TeamPulse — Migration 08: Missing RPCs
-- Run this in the Supabase SQL Editor
-- This fixes two functions that the app calls but were never created:
--   1. create_organization  — used by /onboarding (CreateOrg page)
--   2. accept_invite        — used by /accept-invite page
-- ============================================================


-- ── 1. create_organization ────────────────────────────────────────────────────
-- Called by CreateOrg.jsx when a new user sets up their org for the first time.
-- Creates the org row, then creates an admin membership for the current user.
-- Returns the new org's UUID.

create or replace function public.create_organization(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id    uuid;
  v_full_name text;
begin
  -- Pull the user's display name from Supabase auth metadata
  select raw_user_meta_data->>'full_name' into v_full_name
  from auth.users
  where id = auth.uid();

  -- Create the organization
  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning id into v_org_id;

  -- Make the current user the admin of the new org
  insert into public.memberships (org_id, user_id, role, full_name)
  values (v_org_id, auth.uid(), 'admin', v_full_name);

  return v_org_id;
end;
$$;


-- ── 2. accept_invite ──────────────────────────────────────────────────────────
-- Called by AcceptInvite.jsx when a user clicks an invite link.
-- Creates a membership row and marks the invite as accepted.

create or replace function public.accept_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite    public.invites%rowtype;
  v_full_name text;
begin
  -- Find a valid, un-accepted, non-expired invite
  select * into v_invite
  from public.invites
  where token = p_token
    and accepted = false
    and expires_at > now();

  if not found then
    raise exception 'Invite not found, already used, or expired.';
  end if;

  -- Pull the user's display name from auth metadata
  select raw_user_meta_data->>'full_name' into v_full_name
  from auth.users
  where id = auth.uid();

  -- Create the membership (skip silently if already a member)
  insert into public.memberships (org_id, team_id, user_id, role, full_name, invited_by)
  values (
    v_invite.org_id,
    v_invite.team_id,
    auth.uid(),
    v_invite.role,
    v_full_name,
    v_invite.invited_by
  )
  on conflict (org_id, user_id) do nothing;

  -- Mark the invite as consumed
  update public.invites
  set accepted = true
  where id = v_invite.id;
end;
$$;

