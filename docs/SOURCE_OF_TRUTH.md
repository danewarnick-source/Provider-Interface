# Source of truth map

Every fact has exactly one owner: one table (or column) and one lib file that reads and writes it. Everything else reads from the owner. Before adding a table, column, lib file or computed value, find the row that owns the fact; if none does, add the row in the same PR.

| Fact | Owner table / column | Owner code |
|---|---|---|
| Who works here, their access | `organization_members` (+ `access_*`), `profiles` for identity | `src/lib/access/`, `src/lib/team-members/` |
| Which client a team member supports, with which codes | `staff_assignments` (`client_id`, `service_codes`) | `src/lib/team-members/caseload.ts` |
| Pending team-member invites | `invitations` (revoked by `trg_member_leave_revokes_invites` when the member leaves) | `src/lib/team-members/invites.functions.ts`, `invite-cancel.functions.ts`, `invite-rules.ts` |
| What a client is authorized for (the 1056) | `client_billing_codes` | `src/lib/clients/authorizations.ts` (+ `auth-1056.ts`) |
| Where a client lives (home) | `clients.team_id` → `teams` | `src/lib/clients/` |
| Homes | `teams` | homes route/lib |
| Staff requirements, proof, renewals | `evidence_items`, `evidence_files` | `src/lib/evidence/`, `src/lib/evidence.functions.ts` |
| Hours worked / EVV | `evv_timesheets` | `src/lib/billing-units.ts`, EVV lib |
| Scheduled work | `scheduled_shifts` | `src/lib/scheduler/` |
| Shift notes and daily notes | `daily_logs` | `src/lib/daily-log-*.ts` |
| Incidents | `incident_reports` | `src/lib/incidents.functions.ts` |
| Progress summaries | `client_progress_summaries` | `src/lib/progress-summar*` |
| Notes about a team member (office only) | `staff_notes` | `src/lib/team-members/staff-notes.ts` |
| Hire date | `profiles.hire_date` (not `start_date`) | `src/lib/team-members/profile.ts` |
| Service code facts (EVV, daily-rate, cadence) | code: `src/lib/evv-codes.ts`, `src/lib/service-billing.ts` | same |

Rules:
- **Derived facts are computed, not stored.** Readiness, "needs attention", units left, next due, overdue: one lib function over owner tables, never written to a column, never computed twice. Two screens showing the same derived fact call the same function.
- **Never cache a fact on a second table.** Join or look it up.
- **Facts about persons drive staff rules.** A staff requirement that depends on a client (ABI, behavior plan, code) is derived from the client's record and the assignment, never from a switch on the staff profile.
- **Not a source of truth**, read-only until removed: `employee_client_assignments`, `staff_assigned_to_client`, `assignment_map`, `staff_other_assignments` (→ `staff_assignments`); `company_obligation*`, `obligation_applicability` (→ `evidence_*`); `training_completions`, `hive_training_*`, `training_class*`, `import_cert_documents`, `hr_documents`, `employee_documents` (→ `evidence_files`, except in-platform course progress until Training is rebuilt); `profiles.start_date`, `profiles.requires_abi`, `profiles.requires_deescalation`; `locations` (→ `teams`). When a rebuild touches an area, its prompt names which of these it retires.
- **Two names, one thing:** the UI says "client" / "team member" / "home"; the schema says `clients` / `profiles`+`organization_members` / `teams`. Don't introduce a third name (no "person", "staff", "location", "employee" in new tables or files).
