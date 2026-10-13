# Scheduler rebuild progress

One short report per prompt, newest last.

## S1 — Safety fixes — MERGED
- PR #470 (squash into scheduler-rebuild-a). 18 files added, none deleted; 6 migrations applied to live.
- Migrations: scheduler_safety_helpers, scheduler_safety_day_program_rls, scheduler_safety_shift_write_rls, scheduled_shifts_staff_see_published_only, notifications_scheduler_types, shift_swap_partner_response (ALTER POLICY used; DROP POLICY hung through the Supabase tool).
- Checks: build passed (local-only xlsx shim, sandbox can't fetch xlsx); tsc 219 → 219 (no new); test:unit 6 failures before and after (deploy-aws, nectar onboarding, notification bell, org-subscription, sow-index, team-members import — unrelated, pre-existing), new tests pass; Done-when SQL run on live in a rolled-back transaction, all as expected; GitHub checks: none failed.
- Note: staff also see published shifts on clients/homes they are assigned to (S1 item 10).
