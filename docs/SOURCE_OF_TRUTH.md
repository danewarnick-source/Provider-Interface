# Source of truth map

**Dane's rule (Nov 13, 2026): one fact, one place. Never two or three.** Duplicate copies of a fact are a main cause of the platform breaking.

**Where facts live.** Almost every fact belongs to one of three places in the app:
- **Clients**: anything about a client. Who they are, where they live (their home), their 1056, plans, health, contacts, and which team members support them.
- **Team members**: anything about a staff member. Who they are, their Position, access, Evidence, and which clients they support. Client › Team and Team members › Work show and edit the same assignment rows; there is no second list.
- **Settings**: agency setup and rules. Homes (including host homes and who leads each one), scheduling rules, pay rules, service-code choices.

Every other tab (Scheduler, Daily Logs, Evidence, Summaries, Finances and the rest) **reads** these facts. It shows them read-only, or with an "Edit" link that opens the owning screen, and it never keeps its own copy. A tab may own only the records it creates itself, such as shifts, punches, notes, incidents and summaries.

Every fact has exactly one owner: one table (or column) and one lib file that reads and writes it. Everything else reads from the owner. Before adding a table, column, lib file or computed value, find the row that owns the fact; if none does, add the row in the same PR.

**Each tab's rebuild starts with a source-of-truth check:** list every fact the tab shows, name its owner from this map, and list any copy the tab keeps. The build deletes each copy and reads from the owner instead (after moving any data the owner is missing). Add new duplicates you find to "Known duplicates" below.

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
## Known duplicates (to fix, one owner each)
| Fact | Copies today | Owner it should be | Fix when |
|---|---|---|---|
| Who a client's host is | (1) `staff_assignments` + Position "Host Home Provider" (Daily Logs, `src/lib/daily-log-missing.ts`); (2) `hhs_host_home_settings.hhp_name` free text (Finances › Host home); (3) host home `teams` row + `clients.team_id` | Proposed: the host home is a home in Settings (`teams`), the host is its lead (`teams.manager_id`), and the client's Home (`clients.team_id`) says who lives there. Remove the free-text name; Daily Logs and Finances read the home. Needs Dane's OK. | Before the scheduler's host-away flow is built |
| Where a client lives | `clients.team_id` (owner); `locations` (legacy, synced when a home is saved) | `clients.team_id` → `teams` | Next Homes/Clients work |

## More rules
- **Two names, one thing:** the UI says "client" / "team member" / "home"; the schema says `clients` / `profiles`+`organization_members` / `teams`. Don't introduce a third name (no "person", "staff", "location", "employee" in new tables or files).
