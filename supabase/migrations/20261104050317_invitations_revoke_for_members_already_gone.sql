-- One-time catch-up for trg_member_leave_revokes_invites, which only sees
-- changes from now on: cancel invites still pending for people who were
-- already deleted or deactivated in that agency. On 2026-11-04 this was one
-- invite, left behind when a test team member was deleted.
update public.invitations i
   set status = 'revoked'
  from public.organization_members om
 where i.status = 'pending'
   and om.organization_id = i.organization_id
   and (om.deleted_at is not null or om.active = false)
   and lower(btrim(i.email)) in (
     select lower(btrim(p.email)) from public.profiles p
      where p.id = om.user_id and p.email is not null
     union
     select lower(btrim(u.email)) from auth.users u
      where u.id = om.user_id and u.email is not null
   );
