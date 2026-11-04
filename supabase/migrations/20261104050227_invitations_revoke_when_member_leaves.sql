-- Deleting or deactivating a team member cancels the invites still waiting for
-- them in that agency: the Invited view stops listing them, the Invited count
-- drops, and the old join link shows "This invite is no longer valid."
-- One rule for every path that ends a membership (deactivateMember,
-- soft_delete_person, the leftover-workspace cleanups in the hire and join
-- flows). Additive: main never relies on those invites staying pending.
create or replace function public.revoke_invites_when_member_leaves()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- invitations has no user id; an invite belongs to a person by email
  -- (their profile email or the email they sign in with).
  update public.invitations i
     set status = 'revoked'
   where i.organization_id = new.organization_id
     and i.status = 'pending'
     and lower(btrim(i.email)) in (
       select lower(btrim(p.email)) from public.profiles p
        where p.id = new.user_id and p.email is not null
       union
       select lower(btrim(u.email)) from auth.users u
        where u.id = new.user_id and u.email is not null
     );
  return null;
end;
$$;
revoke all on function public.revoke_invites_when_member_leaves() from public, anon, authenticated;

create trigger trg_member_leave_revokes_invites
  after update of active, deleted_at on public.organization_members
  for each row
  when (
    (new.active = false and old.active is distinct from false)
    or (new.deleted_at is not null and old.deleted_at is null)
  )
  execute function public.revoke_invites_when_member_leaves();
