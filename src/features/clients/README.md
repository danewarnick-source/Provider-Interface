# Clients feature — where things live

"Bug in X" → open the folder in the left column. Each folder has `components/`
and an `index.ts`; code outside a folder imports it through that `index.ts`.
Server functions and pure logic still live in `src/lib/` and `src/hooks/` for
now — they are listed here so there is one map, and move into these folders as
each section is reworked.

Route files in `src/routes/` stay thin (TanStack requires them there):
`dashboard.clients.tsx` (layout + error), `dashboard.clients.index.tsx` /
`dashboard.clients.new.tsx` / `dashboard.hub.clients.tsx` (directory),
`dashboard.clients.$clientId.tsx` (profile; owns the `?tab=` schema and UUID
guard).

| Bug in… | UI | Server / logic |
| --- | --- | --- |
| Client list, filters, chips, Add Client dialog | `directory/` | `lib/client-hr.functions.ts` (`getClientsIntakeProgress`), `hooks/use-client-intake-progress.tsx`, `lib/intake-progress.ts` |
| Profile page shell, tabs, plan/goals, summaries, activity panels | `profile/` | `lib/client-specific-training.functions.ts`, `lib/progress-summaries*.ts`, `lib/import-checklist.functions.ts` |
| Name, DOB, IDs, photo, address, home pin / geofence, face sheet | `general/` | `lib/client-face-sheet.functions.ts`, `lib/client-profile-fields.ts`, `lib/client-features.ts` |
| Doctors, pharmacy, other providers | `contacts/` | `lib/client-healthcare-providers.functions.ts` |
| Support strategies, person-specific training | `support/` | `lib/client-specific-training.functions.ts`, `lib/support-strategy-coverage.ts`, `lib/hrc-restrictions.ts` |
| 1056 codes, units, rates, alerts, assigned staff | `services/authorizations/` | `lib/authorization-guardrails.ts`, `lib/billing-auth-status.tsx`, `lib/client-billing-fix.functions.ts`, `lib/variable-rate-codes.ts`, `hooks/use-client-billing-codes.tsx`, `hooks/use-client-budget.tsx` |
| Personal budget (not the 1056) | `services/personal-budget/` | `lib/client-budget-pdf.ts`, `lib/client-budget-report.ts` |
| File cards, uploads, preview, client file tab | `documents/` | `lib/client-file.functions.ts`, `lib/client-file.ts` |
| Belongings, room & board, RHS cards | `residential/` | `lib/client-belongings.functions.ts` |
| Caseload, preferred / incompatible staff | `care-team/` | `hooks/use-caseload.tsx`, `lib/client-staff-visibility*.ts` |
| Intake checklist, readiness, finish onboarding, setup checklist | `onboarding/` | `lib/client-hr.functions.ts`, `lib/client-readiness.functions.ts`, `lib/intake-progress.ts`, DB trigger `sync_client_intake_status` |
| Compliance panel on the profile | `overview/` | — |
| Section cards, visibility toggles, custom fields, Ask Nectar | `shared/` | — |

Not moved yet (separate routes): referrals (`components/referrals/`, shown as a tab in `routes/dashboard.hub.clients.tsx`;
`lib/referral*.functions.ts`), PBA ledger (`routes/dashboard.pba-ledger.tsx`),
client loans (`routes/dashboard.client-loans.tsx`, `lib/client-loans.functions.ts`),
host homes (`routes/dashboard.host-home-control.tsx`, `lib/host-home-*`),
Smart Import client mode (`routes/dashboard.smart-import*`).
