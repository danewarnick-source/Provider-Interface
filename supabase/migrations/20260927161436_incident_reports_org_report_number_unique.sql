-- Lane B item 2 (Dane-approved via Tony 2026-09-27): report numbers unique per organization.
-- Precheck: SELECT organization_id, report_number, count(*) ... HAVING count(*)>1 -> 0 duplicate groups (2 rows total).
--   report_number is text NOT NULL (0 NULLs), so the NULLs-don't-collide caveat does not apply today.
--   No column default / trigger / DB function generates report_number; the app assigns it, so a colliding
--   app-generated number will now fail with 23505 instead of silently duplicating.
-- Verify: indisvalid=true, indisready=true, indisunique=true. Rolled-back test: duplicate (org A, same number) -> 23505;
--   same number in org B -> allowed.
-- ROLLBACK:
-- DROP INDEX IF EXISTS public.incident_reports_org_report_number_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS incident_reports_org_report_number_uidx ON public.incident_reports (organization_id, report_number);
