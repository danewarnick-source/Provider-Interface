# Employees Tab — Functional Spec, Annotated Wireframes, User Stories

**Scope:** Section 2 of the Feature Tree (2.1 Roster, 2.2 Hosts, 2.3 HR Admin, 2.4 Employee Loans) as it exists in this repository on 2026-09-21.
**Audience:** the human tester working the Feature Tree, Lovable co-editors, and the SQL handoff owner.
**Basis of truth:** every statement below was traced to a route/component/server function/migration in this repo and, where possible, exercised in the mocked browser harness. Nothing here is aspirational; the "should" column is only used where the code and the tree disagree.

> **What this document is NOT.** It is not a live-DB audit. Lovable Cloud gives us no service key or direct DB access, so the schema statements come from `supabase/migrations/` and the SQL in §8 must be run by the human in the Lovable SQL editor to confirm the live shape (CLAUDE.md: *"supabase/migrations/ may NOT match the live DB"*).

---

## 0. How to read this document

### 0.1 Status legend (the tester's four buckets)

| Tag | Meaning in this document |
|---|---|
| **EXACTLY WHAT WE WANT (NO ISSUES)** | Code path traced end-to-end, behaviour matches the tree, and it is covered by a passing unit test or the mocked e2e run in §7. |
| **UNTESTED** | Code path traced and looks correct, but no automated test reaches it and it needs a human pass against the live tenant (usually because it writes through a server function to Supabase Auth, Storage, or email). |
| **NEEDS ATTENTION** | A concrete defect, silent-failure path, dead-end navigation, or copy/behaviour mismatch was found. Each one has a numbered finding in §6 with root cause and the smallest fix. |
| **YET TO BREAK DOWN** | The element leaves the Employees tab (State Audit `4.4.???`, Client profile `3.1.???`, Evidence, Invitations page) and is documented only up to the hand-off point. |

### 0.2 Three lenses per surface

For each surface (Roster, Employee profile, Hosts, HR Admin, Loans) you get:

1. **Functional spec** — inputs, outputs, side effects, permissions, tables touched.
2. **Annotated wireframe** — an ASCII map of the screen with numbered callouts keyed to the Feature Tree IDs.
3. **User stories + acceptance criteria** — the exact checks a tester runs to mark the row green.

### 0.3 Vocabulary used throughout

| Term | Meaning |
|---|---|
| **PI** | Provider Interface — the admin web app under `/dashboard/*`. |
| **Hub** | `/dashboard/hub/employees` — the Employees page with the four tabs. Legacy standalone routes (`/dashboard/employees`, `/dashboard/hr-admin`) still exist and render the same components without the tab strip. |
| **Server function** | A TanStack Start `createServerFn` in `src/lib/*.functions.ts`. Runs on the server with `requireSupabaseAuth` middleware; most use `supabaseAdmin` (service role) *after* re-checking the caller's org membership/role. |
| **Direct client write** | A browser-side `supabase.from(...)` call. Protected only by RLS. Errors surface only if the component checks them. |
| **Owner / Program Manager / Supervisor / Staff** | The PI display labels for `organization_members.role` = `admin` / `program_manager` / `manager` / `employee` (`ROLE_LABEL` in `src/lib/rbac.ts`). |

---

## 1. Navigation and access map

### 1.1 Routes that make up the Employees tab

| Tree | URL | Route file | Renders | Gate |
|---|---|---|---|---|
| 2 | `/dashboard/hub/employees?tab=roster` (default) | `src/routes/dashboard.hub.employees.tsx` | `EmployeesPage` | sidebar item requires `staff_onboarding` feature; page wrapped in `AgencySetupCreateGate` |
| 2.1 | `/dashboard/employees` (legacy, no tab strip) | `src/routes/dashboard.employees.index.tsx` | same `EmployeesPage` | same |
| 2.1.4 | `/dashboard/employees/$staffId?tab=profile\|personnel\|activity` | `src/routes/dashboard.employees.$staffId.tsx` | employee profile | `beforeLoad` redirects if `$staffId` is not a UUID |
| 2.2 | `?tab=hosts` | `src/components/hosts/hosts-page.tsx` | `HostsPage` | tab only appears if caller `can("view_referrals") || can("manage_referrals") || can("view_staff_records")` |
| 2.3 | `?tab=hr-admin` (alias `?tab=compliance` is rewritten to `hr-admin`) | `src/routes/dashboard.hr-admin.tsx` | `HrAdminPage` | `RequirePermission perm="view_staff_records"` |
| 2.3.1 | `/dashboard/compliance?tab=staff\|client\|agency` | `src/routes/dashboard.compliance.tsx` | Staff / Client / Agency file | `StaffFilePanel` additionally requires `ROLE_RANK[role] >= manager` |
| 2.3.1.1.4 | `/dashboard/internal-audit` | `src/routes/dashboard.internal-audit.tsx` | Practice audit | — |
| 2.3.1.1.2 | `/dashboard/reports` | `src/routes/dashboard.reports.tsx` | Audit-ready reports | — |
| 2.3.2 | `/dashboard/hr-admin/settings` | `src/routes/dashboard.hr-admin.settings.tsx` | HR Settings | `RequirePermission perm="edit_staff_records"` |
| 2.4 | `?tab=loans` | `EmployeeLoansPage` in `dashboard.hr-admin.tsx` → `EmployeeLoansPanel` | Loan ledger | `RequirePermission perm="view_staff_records"`; RLS on `employee_loans` requires admin/manager |

### 1.2 The Agency Setup gate (applies to the whole hub)

`AgencySetupCreateGate` calls the `getAgencySetupStatus` server function. If the org has not answered all six required operating questions (`operates_ol_site`, `uses_volunteers`, `has_governing_board`, awarded service codes, approximate client count, service area) **and** is not `createGateExempt` (one-time SQL snapshot for orgs that already had staff), the hub renders `AgencySetupIncompleteCard` ("Finish agency setup first" → `/dashboard/settings/compliance-setup`) instead of the tabs. The same rule is enforced server-side: `hireEmployeeInternal` calls `assertAgencySetupCompleteForOrg` before creating anyone, so a stale browser tab cannot bypass it.

### 1.3 Role defaults that matter here

Baseline from `DEFAULT_MATRIX` (live `role_permissions` may override per org; §8 Q6 confirms):

| Capability | Owner | Program Manager | Supervisor | Staff |
|---|---|---|---|---|
| See Roster / HR Admin / Loans tabs (`view_staff_records`) | yes | yes | yes | no |
| Add employee / Upload roster (server fn `assertOrgManager` → admin, program_manager, manager) | yes | yes | yes | no |
| Edit profile identity (`edit_staff_records`) | yes | yes | no | no |
| Change role (`manage_staff_roles`) | yes | no | no | no |
| Deactivate / Delete (`deactivate_staff` in UI; server fn accepts admin/PM/manager) | yes | UI: no | UI: no | no |
| Save Staff Fields settings (RLS `organizations` UPDATE = `has_org_role(...,'admin')`) | yes | **no (silent)** | **no (silent)** | no |
| Edit host cue cards (`manage_referrals`) | yes | no | no | no |
| Read/write employee loans (RLS `is_org_admin_or_manager`) | yes | yes (helper includes `program_manager` since `20260825020000`; confirm live with Q7) | yes | no |

---

## 2. Surface 2.1 — Roster

### 2.1.A Functional spec

**Purpose.** Single list of every `organization_members` row for the current org joined in JS to `profiles` (never PostgREST-embedded — no FK), plus the org's pending `invitations`. Entry point for hiring, deactivation, deletion, password reset, and caseload assignment.

**Data loads (React Query keys → source).**

| Key | Source | Notes |
|---|---|---|
| `["members", orgId]` | `organization_members` (all rows for org) then `profiles` by `user_id` | Two queries, joined in JS. `last_sign_in_at` comes from the `org_member_last_sign_in` RPC, parsed by `lastLoginByUserId`. |
| `["invites", orgId]` | `invitations` where `status = 'pending'` | Rendered as the "Pending invitations" card only when non-empty. |
| Staff Fields config | `organizations.feature_config.staff_intake_fields` | Read on wizard open and on Settings open. |

**Active/Inactive rule** (`isEmployeeOnActiveRoster`, unit-tested): a member is *Active* only if `organization_members.active = true` **and** `profiles.account_status != 'archived'` **and** `profiles.is_active != false`. Everything else is *Inactive*. Header count "N active · M pending invite" uses the same rule.

**Mutations (button → server function → effect).**

| Button | Server function / write | Effect on data | Side effects |
|---|---|---|---|
| Add employee → Create employee | `createEmployeeManually` → `hireEmployeeInternal(createdVia="manual_admin")` | `auth.users` created with generated temporary password; `profiles` upsert (`must_change_password = true`, first/last/email/phone/hire_date/job_title, optional staff_type/department/employee_id/worker_type/custom_fields); `organization_members` insert with role | `role_change_audit_log` row; `onStaffHiredInternal` re-evaluates obligations (Staff file instances created); throws if profile with that email already exists |
| Add employee → Send N invites | `createInvitation` (falls back to `resendInvitation` if a pending invite exists) | `invitations` row (`status='pending'`, token) | Email via the invite rail using `resolveAuthOrigin()`; toast lists per-email outcome |
| Upload roster → Apply | `applyEmployeeRosterRow` per row | mode-dependent: `create` → same as manual hire; `update` → `profiles` + `organization_members.role` update; `skip` → nothing | same hooks as manual hire; template download is client-side XLSX |
| Caseload → Save Caseload Modifications | **direct client writes** to `staff_assignments` (delete removed ids, insert added ids) | `staff_assignments (organization_id, staff_id, client_id)` | Calls `onStaffAssignmentRemoved` / `onStaffAssignmentCreated(serviceCodes: [])` server hooks; hook failures are swallowed with `console.warn` |
| ⋯ → Reset password | `adminResetEmployeePassword` | `auth.users.password` set via `auth.admin.updateUserById`; `profiles.must_change_password = true` | Dialog shows the generated password once with Copy |
| ⋯ → Deactivate | `archiveEntity(kind="employee")` | `profiles.account_status='archived', team_id=null, is_active=false`; `organization_members.active=false` | Global sign-out of that user; blocked if the caller is not admin/PM/manager in that org |
| ⋯ → Reactivate (Inactive tab only) | `restoreEntity` | `profiles.account_status='active', is_active=true`; `organization_members.active=true` | — |
| ⋯ → Delete → type name → Delete permanently | `deleteEntity` | removes `organization_members` row for **this org**; if it was the user's last org: deletes `course_assignments`, `external_certifications`, `pba_*`, `profiles`, and the `auth.users` row | Cannot be undone; requires exact (case-insensitive) name match |
| Pending invitations → Resend / Copy link / Uninvite | `resendInvitation` / clipboard / `revokeInvitation` | `invitations.status` → `revoked` on Uninvite | Uninvite uses a browser `confirm()` |
| Settings → any toggle | **direct client** `organizations.update({feature_config})` debounced 500 ms | `organizations.feature_config.staff_intake_fields` | **No error handling** — see Finding F-1 |

**Role labels on this screen.** The ROLE column shows the raw enum (`ADMIN`, `MANAGER`, `EMPLOYEE`, `PROGRAM_MANAGER`) as a badge; the Add-employee wizard offers **Employee / Manager / Admin** (Program Manager and Committee Member can only be set later from the profile), while the profile and the rest of PI label the same values **Staff / Supervisor / Owner**. See Finding F-6.

### 2.1.B Annotated wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Employees                                   [Roster] [Hosts] [HR Admin] [Employee Loans] │  ← Hub tab strip (2, 2.2, 2.3, 2.4)
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ① Team members                                  [⬆ Upload roster] [＋ Add employee] [⚙ Settings] │  2.1.1 / 2.1.1.1 / 2.1.1.2 / 2.1.1.3
│    5 active · 1 pending invite                                                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ② Pending invitations   (card only shows when ≥1 pending)                            │  (not in tree — document it)
│    ✉ new.dsp@example.test · employee              [↻ Resend] [⧉ Copy link] [⊘ Uninvite] │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ③ [Active ●5] [Inactive ●0]                                                           │  2.1.2
├────────┬──────────────┬──────────┬────────┬────────────┬────────────┬────────────────┤
│ NAME   │ LOGIN        │ ROLE     │ STATUS │ START DATE │ LAST LOGIN │ ACTIONS        │  2.1.3.1 … 2.1.3.7
│ ④ Jake │ jake.probert │ EMPLOYEE │ Active │ Jan 15 2025│ Aug 27 2026│ [👥 Caseload] ⋯│  ④ row click → 2.1.4
│   DSP  │              │          │        │            │            │                │
└────────┴──────────────┴──────────┴────────┴────────────┴────────────┴────────────────┘
```

**Callouts**

- **①** Header. Counts are computed client-side from the members query with the Active rule above.
- **② Pending invitations.** Not in the tree but always present when a join link is outstanding. Resend keeps the same token/email; Copy link copies the join URL built from `resolveAuthOrigin()`; Uninvite asks `confirm()` then revokes.
- **③ Active / Inactive pill.** Pure client-side filter (`filterEmployeesByRosterTab`). Counts in the pills come from `countEmployeesOnRosterTab`. Empty Inactive tab shows "No deactivated employees".
- **④ Row.** Clicking anywhere on the row (except inside ACTIONS) navigates to `/dashboard/employees/$staffId`. NAME shows full name over `job_title`. LOGIN shows `profiles.username` if set, else email. STATUS badge = Active / Deactivated. START DATE = `profiles.hire_date` (fallback `start_date`) formatted by `formatRosterDate`. LAST LOGIN = "Never" or a date from the RPC.
- **ACTIONS → Caseload** opens the side sheet (2.1.3.7.1). **ACTIONS → ⋯** opens the menu: Reset password; Deactivate (Active tab) or Reactivate (Inactive tab); Delete.

**Upload roster dialog (2.1.1.1)**

```
┌ Upload roster ──────────────────────────────────────────────┐
│ ○ Add new only               Skip emails already on roster  │ 2.1.1.1.1
│ ○ Add new and update existing  Match on email               │ 2.1.1.1.2
│ ○ Update existing only       New emails are skipped         │ 2.1.1.1.3
│ [⬇ Download template]                                       │ 2.1.1.1.4 → browser downloads employee-roster-template.xlsx
│ ┌ Drop CSV or Excel file, or click to choose ─────────────┐ │ 2.1.1.1.5
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
        ↓ file parsed (PapaParse / XLSX), headers normalised
┌ Review staff rows ──────────────────────────────────────────┐
│ editable grid: first_name last_name email phone role title  │
│                hire_date username  · per-row action badge   │  create / update / skip
│ red cells = validation issue (max 8 listed)                 │
│                        [Back]  [Apply 3 new, 1 update]      │  button label comes from classifyRosterRowAction counts
└──────────────────────────────────────────────────────────────┘
        ↓
┌ Send invites? ──────────────────────────────────────────────┐  identical to Add-employee step 2
└──────────────────────────────────────────────────────────────┘
```

**Add employee dialog (2.1.1.2)**

```
┌ Add employee ──────────────────────────────────── [X] ┐  2.1.1.2.1.10 — X or Esc closes; unsaved drafts are discarded (state reset on reopen)
│ Creates the full staff record first. You can send a  │
│ join email or copy a temporary password after.       │
│ ┌ Employee 1 ─────────────────────────────────────┐  │
│ │ First name*  Last name*  Email*  Phone*         │  │  2.1.1.2.1.1–4  (all four + hire date are required by the client check)
│ │ Hire date*   Role ▾ [Employee|Manager|Admin]    │  │  2.1.1.2.1.5–6
│ │ Staff type ▾ (only if enabled in Settings)      │  │  2.1.1.2.1.7 — options = feature_config.staff_intake_fields.staff_type.options
│ │ Department ▾ / Employee ID / Worker type ▾      │  │  (each only when enabled in Settings)
│ │ Custom fields …                                 │  │  (from Settings → Custom fields)
│ └─────────────────────────────────────────────────┘  │
│ [＋ Add another employee]                            │  2.1.1.2.1.8 — appends another draft card; no upper bound; each card has 🗑 remove
│                                  [Create employee]   │  2.1.1.2.1.9 — label becomes "Create N employees" for N>1
└──────────────────────────────────────────────────────┘
        ↓ createEmployeeManually per draft (partial success → warning toast listing failures)
┌ Send invites? ───────────────────────────────────────┐
│ Check who should get a join email. Nothing is sent   │
│ unless you choose it.                                │
│ ☐ Sep Tester  sep1.tester@example.test              │  nobody is pre-checked
│   [🔑 Show temporary password] → shows once + [⧉]    │  "They will be asked to change this on first sign-in."
│ [Set up Evidence pack] [Don't invite yet] [Send 0 invites ▸ disabled] │
└──────────────────────────────────────────────────────┘
```

**Settings sheet (2.1.1.3) — "Staff fields"**

```
┌ Staff fields · Configure visible fields ──────────── [X] ┐  2.1.1.3.2
│ Cannot be turned off                                     │  2.1.1.3.1.1
│   First name · Last name · Email address · Phone number  │
│   · Hire date · Role                                     │
│ Standard fields                                          │  2.1.1.3.1.2
│   [●] Staff type      chips: DSP × HHP × Exec Dir × …    │  2.1.1.3.1.2.1  default ON, 5 default options
│         [type option…] [Add]                             │
│   [○] Department      chips: Host Home × Day Support × … │  2.1.1.3.1.2.2  default OFF
│   [○] Employee ID                                        │  2.1.1.3.1.2.3
│   [○] Worker type     (W2 Employee / 1099 Contractor / Other, fixed) │ 2.1.1.3.1.2.4
│ Custom fields                     [＋ Add field]         │  2.1.1.3.1.3
│   Field name ____  Field type ▾ [Text|Date|Yes/No|Number|Dropdown]  [Cancel] [Save] │
│ "Saved" flashes 2 s after a successful write             │
└──────────────────────────────────────────────────────────┘
```

**Caseload Assignment Center (2.1.3.7.1) — right-hand sheet**

```
┌ Caseload Assignment Center: Jake Probert ─────────── [X] ┐  2.1.3.7.1.1.4
│ 🔍 Search by client name                                 │  2.1.3.7.1.1.1 — also matches job_code
│ ☑ Blake Allen        HHS · SLN                           │  2.1.3.7.1.1.2 — one checkbox per client in the org (clients.id/name/job_code)
│ ☐ …                                                      │
│                       [Save Caseload Modifications]      │  2.1.3.7.1.1.3 — diff vs. original set; toast "Caseload updated successfully for …"
└──────────────────────────────────────────────────────────┘
```

### 2.1.C User stories and acceptance criteria

| ID | As a… | I want… | Pass criteria |
|---|---|---|---|
| US-R1 | Supervisor/Owner | to see who is on staff and who is deactivated | Active tab lists every member passing the Active rule; Inactive tab lists the rest; header count equals Active tab count; a member with `profiles.is_active=false` but `organization_members.active=true` appears under Inactive (unit test `employee-roster.test.ts` covers this). |
| US-R2 | Owner | to hire someone with a complete file in one step | Fill 5 required fields → Create employee → toast "Employee file created" → person appears in Active list with correct role and hire date → Staff file tab of that person already shows obligation rows (hook ran). Entering an email that already has a profile shows an error toast, not a duplicate. |
| US-R3 | Owner | to hand a new hire a way in | Step 2 offers per-person checkbox + "Show temporary password". Sending 1 invite creates one `invitations` row and one email; toast reports "Invite emailed to …" or the specific failure. "Don't invite yet" closes with nothing sent. |
| US-R4 | Owner | to bulk-load a roster | Download template → fill → drop file → rows classified as create/update/skip exactly per chosen mode (unit tests `employee-roster-upload.test.ts`) → invalid rows highlighted and Apply disabled → Apply creates/updates → step 2 identical to US-R3. |
| US-R5 | Owner | to control which intake fields staff see | Toggling Department ON then reopening the Add-employee wizard shows a Department dropdown; adding an option makes it selectable; a custom Date field appears as a date input; toggles survive a page reload. **Currently fails for non-Owner roles without any error (F-1).** |
| US-R6 | Supervisor | to assign a client caseload | Open Caseload → check two clients → Save → reopen shows both checked; unchecking one and saving removes it; `staff_assignments` has exactly the checked rows for that staff. |
| US-R7 | Owner | to reset a password for a locked-out staffer | Reset password → dialog shows a new temporary password + Copy → staffer logs in and is forced to change it (`must_change_password` enforced at router root). |
| US-R8 | Owner | to remove access safely | Deactivate moves the row to Inactive immediately, the staffer's sessions are ended, and Reactivate restores them. Delete requires typing the exact name; after Delete the row is gone and — if this was their only org — the login no longer exists. |

### 2.1.D Status by tree ID — Roster

| Tree ID | Element | Status | Note |
|---|---|---|---|
| 2.1.1 | Team Members header | **EXACTLY WHAT WE WANT** | e2e #4 asserts header, pills, columns |
| 2.1.1.1 | Upload roster | **EXACTLY WHAT WE WANT** (parsing/classification) / **UNTESTED** (live apply) | unit-tested parse + classify; server apply not exercised in harness |
| 2.1.1.1.1–3 | Three modes | **EXACTLY WHAT WE WANT** | `classifyRosterRowAction` unit tests |
| 2.1.1.1.4 | Download template | **EXACTLY WHAT WE WANT** | client-side XLSX, 8 headers listed in §2.1.A |
| 2.1.1.1.5 | Drop zone | **UNTESTED** | manual drag/drop not automated |
| 2.1.1.2 | Add employee | **EXACTLY WHAT WE WANT** | e2e #5 walks step 1 → step 2 → send 1 invite |
| 2.1.1.2.1.6 | Role options | **NEEDS ATTENTION** | F-6: labels differ from PI (Staff/Supervisor/Owner); Program Manager missing |
| 2.1.1.2.1.7 | Staff type options | **EXACTLY WHAT WE WANT** | 5 defaults match tree; driven by Settings |
| 2.1.1.2.1.8 | Add another employee | **EXACTLY WHAT WE WANT** | unbounded; per-card remove |
| 2.1.1.2.1.9 | Create employee | **EXACTLY WHAT WE WANT** | |
| 2.1.1.2.1.10 | Exit (X) | **EXACTLY WHAT WE WANT** | drafts discarded, no orphan writes |
| 2.1.1.3 | Settings | **NEEDS ATTENTION** | F-1: "doesn't save toggles" reproduced by code trace — silent RLS no-op for Program Manager/Supervisor, and the "Saved" flash lies |
| 2.1.1.3.1.1 | Cannot be turned off list | **EXACTLY WHAT WE WANT** | `ALWAYS_REQUIRED` constant |
| 2.1.1.3.1.2.x | Standard field toggles/options | **NEEDS ATTENTION** | same as F-1 (Owner works; others silent) |
| 2.1.1.3.1.3 | Custom fields | **NEEDS ATTENTION** | same as F-1; delete of a custom field is unit-tested (`custom-field-delete.test.ts`) |
| 2.1.2 | Active/Inactive pill | **EXACTLY WHAT WE WANT** | e2e #4 toggles both |
| 2.1.3.1–7 | Columns | **EXACTLY WHAT WE WANT** | e2e #4 asserts Name…Last Login |
| 2.1.3.7.1 | Caseload sheet | **UNTESTED** / **NEEDS ATTENTION** | F-4: direct client writes, empty `serviceCodes`, swallowed hook errors |
| 2.1.3.7.2.1 | Reset password | **UNTESTED** | Supabase Auth write; needs live pass |
| 2.1.3.7.2.2 | Deactivate | **UNTESTED** | server fn traced; also Reactivate on Inactive tab (not in tree) |
| 2.1.3.7.2.3 | Delete | **UNTESTED** | typed-name confirm; cascade rules in §2.1.A |

---

## 3. Surface 2.1.4 — Employee profile ("Employee Pill")

### 3.A Functional spec

**Route.** `/dashboard/employees/$staffId?tab=profile|personnel|activity`. `tab` omitted = Profile. Route guard redirects non-UUID ids.

**Header loads.** `organization_members` row for `(org, staffId)` + `profiles` row → name, role badge (raw enum), Active/Deactivated badge, hire date, avatar from bucket `staff-photos`.

**Back navigation (2.1.4.1 and 2.1.4.2).** Both "← Employees" and "Back to list" run the same code: `window.history.length > 1 ? router.history.back() : navigate("/dashboard/hub/employees")`. Because switching Profile/Staff file/Activity tabs pushes a history entry, after visiting two tabs the first Back returns to the previous *tab*, not the list (Finding F-7).

**Face Sheet (2.1.4.3).** Dropdown pill → `generateEmployeeFaceSheetFn({ staffId, organizationId, action })`.

| Action | Behaviour |
|---|---|
| Preview | opens the generated PDF in a new tab |
| Download PDF | forces `employee-face-sheet-<name>.pdf` download |
| Print | opens the PDF and calls the browser print dialog |
| Ship to HR Docs | server uploads the PDF to the staff documents bucket and inserts an `employee_documents` row; toast confirms |

**Profile tab (2.1.4.4).** `StaffProfilePanel` with three collapsible sections and one Edit mode:

| Section | Read source | Write path on Save | Permission |
|---|---|---|---|
| Profile (2.1.4.4.1) | `loadStaffProfileIdentity` (profiles + member, bound to route `staffId` — unit-tested lock) | direct `profiles` update (first/last/email/phone/hire_date/employee_id/job_title) + `setMemberGrants` for role | identity: `edit_staff_records`; role select only enabled with `manage_staff_roles`; role options = Staff, Supervisor, Program Manager, Owner, Committee Member |
| Leads group / Scope (2.1.4.4.2) | `loadEmployeeScope` → org scope snapshot (`staff_groups`, `staff_group_members`, `profiles.scope_group_id`) | `setEmployeeScope` | if the snapshot reports `available:false` the section shows *"Scope columns are not live yet. Core Soft applies them after merge."* (this is what the mocked run showed — confirm live with §8 Q4) |
| Permissions (2.1.4.4.3) | `useEffectivePermissions`: `role_permissions` matrix + `user_permission_overrides` for this user | `saveStaffPermissionToggles` — computes minimal upserts/deletes against role default (unit-tested `staff-permission-toggles.test.ts`), writes `user_permission_overrides`, logs `permission_audit_log`, and inserts a `notifications` row for the staffer | `manage_permissions` |

Permissions render in three groups with the exact counts in the tree: **People & Files (52)**, **Schedule & Money (20)**, **Staff Phone Permissions (11)** = 83 = `ALL_PERMISSIONS.length` (asserted by `profile-permission-groups.test.ts`). Each row shows the switch, the role default, and an "override" marker when the user differs from role. Full catalogue with role defaults is in Appendix A.

**Edit profile / Save / Cancel (2.1.4.4.4).** One Edit button turns all three sections editable. Save runs identity → grants → permission toggles → scope sequentially and invalidates the member, identity, overrides and roster queries. Cancel discards the drafts. The tree lists "Save Profile" and "Cancel" under the same ID (2.1.4.4.4.1) — treat as 2.1.4.4.4.1 and 2.1.4.4.4.2.

**Staff file tab (2.1.4.5).** `StaffObligationsFilesTab` → `listStaffObligationInstances` (server) → one row per `company_obligation_instances` assigned to this staffer, decorated with the latest `company_obligation_completions` evidence and any active override.

Status vocabulary (`obligationFileStatus`, unit-tested):

| Label | Rule |
|---|---|
| **On file** | a valid evidence completion exists |
| **Due soon** | no evidence, due date is in the future **and within 7 days** |
| **Missing** | everything else — including items due months from now with no upload yet, and overdue items (the Due column then reads "Missing — N days ago") |

So the tester's *"Status (Missing??)"* is expected behaviour for a brand-new hire: every annual item starts as Missing until evidence is uploaded, regardless of due date.

| Button | Behaviour |
|---|---|
| View selected (2.1.4.5.1) | opens a viewer dialog for the checked rows that have evidence (`obligation-evidence` bucket, 5-minute signed URL); disabled when nothing checked |
| Print / PDF pack (2.1.4.5.2) | builds `personnelPackHtml` of the selected evidence files in a new window and calls `print()` — pop-up blockers produce an error toast |
| Upload evidence… (2.1.4.5.3) | dialog: pick the obligation row, choose a file, optional note → `recordCompletion` → storage upload + `company_obligation_completions` insert → row flips to On file |
| Row → Override | `RecordOverrideDialog` records a waiver/override with reason; history shown under "Override history" |
| View (2.1.4.5.4.4) | per-row eye icon; enabled only when the row has evidence (matches the tree note) |

**Activity tab (2.1.4.6).** Read-only, newest first, built client-side from three direct queries scoped to org + staff:

| Filter chip | Source | Columns / item shape |
|---|---|---|
| All | union of the below | one line per item |
| Shifts | `evv_timesheets` (staff_id, ≤200) with `clients` name lookup | table: Date · Client (link to chart) · Code · Status · Units (`billed_units`) |
| Timesheets | same `evv_timesheets` rows **that have a status** | "CODE · N u", status badge, date = clock-in |
| Forms | `form_submissions` where `submitted_by = staff` (≤100) with `forms.name` | form name · status · submitted date |
| Incidents | `incident_reports` where `reported_by = staff` (≤100) | `report_number · incident_types joined by comma` · status (e.g. *pending admin review*) · `filed_at` |

The tree's "IR ID Badge → Injury / Illness / ??" is the `incident_types` array on the report; the label set is whatever the Incident form allows (out of scope here → **YET TO BREAK DOWN**). Every EVV row that has a status appears **twice** in "All" (once as a Shift, once as a Timesheet) — Finding F-8.

### 3.B Annotated wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [← Employees] (JP) Jake Probert                                        [Back to list] │ 2.1.4.2 / 2.1.4.1 (same action)
│               [EMPLOYEE] [ACTIVE] [📄 Face Sheet ▾] · Hired 2025-01-15               │ 2.1.4.3 → Preview / Download PDF / Print / Ship to HR Docs
├────────────────────────────────────────────────────────────────────────────────────┤
│ [Profile] [Staff file] [Activity]                                                    │ 2.1.4.4 / 2.1.4.5 / 2.1.4.6
├────────────────────────────────────────────────────────────────────────────────────┤
│ ▸ PROFILE                                                        [Edit profile]      │ 2.1.4.4.1 / 2.1.4.4.4
│   (photo)  FIRST NAME  LAST NAME  EMAIL  USERNAME  PHONE  BASE ROLE                  │
│            HIRE DATE   EMPLOYEE ID  JOB TITLE  (+ enabled staff fields)              │
│ ▸ Leads group / Scope                                                                │ 2.1.4.4.2
│   Scope group ▾   Lead group ▾      — or — "Scope columns are not live yet…"         │
│ ▸ Permissions                                                                        │ 2.1.4.4.3
│   ▸ People & Files (52)        ▸ Schedule & Money (20)    ▸ Staff phone (11)         │ 2.1.4.4.3.1 / .2 / .3
│     [●] Invite staff      role: on                                                   │ each row: switch · role default · "override" tag
│                                                   [Cancel] [Save profile]  (edit mode) │ 2.1.4.4.4.1 / .2
└────────────────────────────────────────────────────────────────────────────────────┘

Staff file tab:
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [View selected] [🖨 Print / PDF pack] [⬆ Upload evidence…]                            │ 2.1.4.5.1–3
│ ☐ │ ITEM                                     │ STATUS   │ DUE            │ VIEW │ … │ 2.1.4.5.4
│ ☐ │ Background Screening — Annual            │ Missing  │ in 214 days    │ 👁 (off)│ Override │
│ ☐ │ Medicaid Disclosure Form — Annual        │ Missing  │ in 214 days    │ 👁 (off)│          │
│ ☐ │ Medicaid Fraud & Abuse Exclusion — Annual│ On file  │ 2027-03-01     │ 👁      │          │
└────────────────────────────────────────────────────────────────────────────────────┘

Activity tab:
┌ Activity                                                    Read-only · newest first ┐
│ [All] [Shifts] [Timesheets] [Forms] [Incidents]                                        │ 2.1.4.6.1–5
│ Shifts view → DATE | CLIENT | CODE | STATUS | UNITS                                    │ 2.1.4.6.2.1–5
│ other views → "TITLE" · status badge · date                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.C User stories and acceptance criteria

| ID | As a… | I want… | Pass criteria |
|---|---|---|---|
| US-P1 | Owner | to open a staffer and see identity at a glance | Header shows name, role, Active/Deactivated, hire date; Profile section shows the same values as the roster row; e2e #4 asserts the page is bound to the route `staffId` (regression lock from the "wrong person" bug). |
| US-P2 | Owner | to correct identity fields | Edit profile → change phone and job title → Save → toast → reload shows new values → roster row shows new title. |
| US-P3 | Owner | to change someone's role | Edit → Base role → Program Manager → Save → header badge and roster ROLE column update; `role_change_audit_log` gains a row; Supervisor cannot change role (select disabled). |
| US-P4 | Owner | to grant one extra permission without changing role | Edit → Permissions → People & Files → switch "Approve daily logs" on for a Supervisor → Save → row shows *override*; `user_permission_overrides` has exactly one row for that user/perm; switching it back to the role default deletes the override rather than storing a redundant one (unit test). |
| US-P5 | Compliance lead | to see and cure a staffer's missing items | New hire's Staff file shows every applicable annual item as Missing; Upload evidence → pick item → file → row becomes On file and View is enabled; Print / PDF pack prints only checked rows. |
| US-P6 | Auditor | to pull a face sheet | Face Sheet → Download PDF produces a PDF with the profile fields; Ship to HR Docs makes the same PDF appear in the staffer's documents. |
| US-P7 | Supervisor | to review what a staffer has done | Activity → Shifts lists that staffer's EVV rows with client link, code, status, units; Incidents lists reports they filed with the report number and type. |

### 3.D Status by tree ID — Employee profile

| Tree ID | Element | Status | Note |
|---|---|---|---|
| 2.1.4.1 / 2.1.4.2 | Back to list / ← Employees | **NEEDS ATTENTION** | F-7: `history.back()` returns to previous tab, not the list |
| 2.1.4.3.1–4 | Face sheet actions | **UNTESTED** | server PDF + storage; needs live pass |
| 2.1.4.4.1 | Profile section | **EXACTLY WHAT WE WANT** | e2e #4 + `staff-profile-identity.test.ts` |
| 2.1.4.4.2 | Leads group / Scope | **UNTESTED** | depends on live `staff_groups`; mocked run shows "not live yet" fallback; §8 Q4 |
| 2.1.4.4.3 | Permissions (52/20/11) | **EXACTLY WHAT WE WANT** (grouping, counts, planner) / **UNTESTED** (live save) | unit tests; live write needs pass |
| 2.1.4.4.4 | Edit / Save / Cancel | **UNTESTED** | sequential save of 4 writers; one failure leaves earlier writes committed (F-9) |
| 2.1.4.5.1–3 | View selected / Print pack / Upload evidence | **UNTESTED** | storage + server fn |
| 2.1.4.5.4.2 | Status "Missing??" | **EXACTLY WHAT WE WANT** | by design; 7-day Due-soon window; unit-tested |
| 2.1.4.5.4.4 | View enabled only with evidence | **EXACTLY WHAT WE WANT** | |
| 2.1.4.6.x | Activity filters | **NEEDS ATTENTION** | F-8 duplicate Shift/Timesheet items; otherwise fine |
| 2.1.4.6 Incidents types | IR type labels | **YET TO BREAK DOWN** | lives in Incident Reports feature |

---

## 4. Surface 2.2 — Hosts

### 4.A Functional spec

**Purpose.** Kanban of Host Home Provider (HHP) *cue cards* — matching-side data about a household. Hosts are **not staff**: they never clock in, never appear in the scheduler or EVV (CLAUDE.md residential model). A cue card can optionally be linked to a staff login (`linked_staff_user_id`) when the same person also works as a DSP.

**Data.** `hhp_cue_cards` (migration `20260612135044`), one row per host, `status ∈ {onboarding, ready, placed}`. Loaded by `listHhpCueCards` (server, org-scoped). Certification badge reads `host_home_certifications` (latest `next_due_date` per card).

**Actions.**

| Element | Behaviour | Permission |
|---|---|---|
| New host (2.2.1) → Create host | `createHhpCueCard` inserts a row with `status='onboarding'`; comma fields split into `medical_comfort[]` / `independence_levels_accepted[]`; checkboxes map to booleans | tab visible with `view_staff_records`; creation succeeds for any org member the server fn allows (it only checks membership) |
| Card click | `HostDetailDialog`: read-only KV block of the intake fields, editable **Status** select, **Provider notes**, **Link to staff** select (lists active members) with "Invite as staff" → `/dashboard/invitations`, and `HostCertificationPanel` (inspection history, new certification) | edits require `manage_referrals` (Owner-only by default) — others see disabled controls with no explanation (F-5) |
| Save (in dialog) | `updateHhpCueCard` partial update | `manage_referrals` |

Status columns and card chips (2.2.2–2.2.4): **Onboarding**, **Ready**, **Placed**; each card shows Name, the HHS-cert badge (*No cert* / *Cert overdue* / *Cert due Nd* (≤30 d) / *Cert ✓*), an **Also DSP** chip when `linked_staff_user_id` is set, and the status label. The tree lists these under 2.2.4 (Placed) only — they render in all three columns.

The page subtitle also states that *"Submitting a Host Home Questionnaire auto-creates a card"* — that inbound path is outside this tab (**YET TO BREAK DOWN**).

### 4.B Annotated wireframe

```
┌ Host Home Providers                                                   [＋ New host] ┐ 2.2.1
│ HHP cue cards — host-side matching input. Hosts are not staff…                      │
│ ┌ Onboarding (n) ┐ ┌ Ready (n) ┐ ┌ Placed (n) ┐                                     │ 2.2.2 / 2.2.3 / 2.2.4
│ │ Jane Host       │ │           │ │ Sam Host   │                                     │ 2.2.4.1 Name
│ │ [No cert]       │ │           │ │ [Cert ✓]   │                                     │ 2.2.4.2 HHS Cert badge
│ │ [Also DSP]      │ │           │ │            │                                     │ 2.2.4.3 linked_staff_user_id
│ │ Onboarding      │ │           │ │ Placed     │                                     │ 2.2.4.4 status label
│ └─────────────────┘ └───────────┘ └────────────┘                                     │
└──────────────────────────────────────────────────────────────────────────────────────┘

New host cue card (dialog):
 Name*  Phone  Email  Address  City  County  Pets                                       2.2.1.1.1–7
 ☐ Wheelchair accessible  ☐ Sign language  ☐ Criminal history flag                     2.2.1.1.8–10
 Experience summary  Behavioral comfort  Communication abilities                       2.2.1.1.11–13
 Medical comfort (comma)  Independence levels (comma)                                  2.2.1.1.14–15
 Schedule availability  Commitment length                                              2.2.1.1.16–17
                                                     [Create host]  [X]               2.2.1.1.18 (both numbered .18 in the tree)
```

### 4.C User stories

| ID | As a… | I want… | Pass criteria |
|---|---|---|---|
| US-H1 | Owner | to capture a prospective host household | Create host with only a Name → card appears under Onboarding with "No cert"; reopening shows every entered field; comma lists render as arrays. |
| US-H2 | Owner | to move a host through onboarding | Open card → Status = Ready → Save → card moves columns; Placed likewise. |
| US-H3 | Owner | to recognise a host who is also on payroll | Link to staff → pick the DSP → Save → card shows *Also DSP*; that person still appears on the Roster; the host card never appears in the Scheduler. |
| US-H4 | Owner | to see certification risk | A host with `host_home_certifications.next_due_date` within 30 days shows the amber "Cert due Nd" badge; past due shows red. |

### 4.D Status — Hosts

| Tree ID | Element | Status | Note |
|---|---|---|---|
| 2.2 | Hosts tab renders | **EXACTLY WHAT WE WANT** | mocked probe: three columns, New host, no console errors |
| 2.2.1 / 2.2.1.1.x | New host form fields | **EXACTLY WHAT WE WANT** (fields match tree 1:1) / **UNTESTED** (live insert) | |
| 2.2.2–2.2.4 | Columns and chips | **EXACTLY WHAT WE WANT** | |
| Card detail → Save / Link to staff | edit rights | **NEEDS ATTENTION** | F-5: Supervisors/PMs can open but not edit, with no hint |
| Questionnaire → auto-card | inbound path | **YET TO BREAK DOWN** | |

---

## 5. Surface 2.3 — HR Admin

### 5.A Functional spec

**What the tab itself contains.** `HrAdminPage` is thin: a header ("Other trainings and HR settings. File status for every staffer lives on **Staff file**."), two buttons — **Open Staff file** (→ `/dashboard/compliance?tab=staff`) and **HR Settings** (→ `/dashboard/hr-admin/settings`) — and the **Other Trainings & Tasks (rollup)** card. The Staff file link in the sentence and the button do the same thing (tree 2.3.1 notes this correctly). The tester's question *"move this tab entirely?"* is a product call; functionally the tab is a launcher plus one card.

**Other Trainings & Tasks rollup (2.3.3–2.3.5).** `listOrgOtherAssignments` → `staff_other_assignments`. Header badges: *N NECTAR proposals* (unconfirmed rows), *N open* (confirmed, not completed), *N done* (completed). Empty state "No assignments yet." Rows sort safety-critical + overdue first. Purely a read view here; assignments are created from Training.

**HR Settings (2.3.2).** Renders one card, `StaffTypesProposal` ("Staff types & applicability"). Until someone clicks **Run NECTAR proposal** the card body is the dashed box *"No proposal yet. Click Run NECTAR proposal to derive staff types…"* — which is what the tester saw as an *EMPTY PAGE*. After a proposal: editable staff-type list (add/remove), a per-requirement "applies to" mapping, and **Confirm all** (until confirmed nothing renders as N/A anywhere). There **is** a back button ("← HR Admin") in the code, but it returns to the standalone `/dashboard/hr-admin` route, not to the hub tab (F-2). Note the tree's *Staff Fields* settings (2.1.1.3) live on the Roster, not here — two different "HR settings" surfaces (F-3).

**Staff file (2.3.1.1) — `/dashboard/compliance?tab=staff`.** `StaffFilePanel`:

- top-right text links **State Audit** (→ `/dashboard/state-audit`, tree `4.4.???`) and **Reports** (→ `/dashboard/reports`);
- amber card *"N certificates awaiting review"* when `listPendingCertReviews` returns rows (each → `/dashboard/compliance/cert-review/$completionId`, plus an exam-export button for in-Hive courses);
- `PacketNextActionCard` (the single next action from the compliance packet) and a scope note when the caller's view is scoped to a lead group;
- `OrgPersonnelFileMatrix` — the table in the tree.

`OrgPersonnelFileMatrix` (`listOrgPersonnelFileMatrix` server fn over `company_obligation_instances` + `_assignees` + `_completions`, one row per active/inactive member):

| Element | Behaviour |
|---|---|
| Search (2.3.1.1.3) | client-side filter on name, role, job title, service codes |
| Practice audit (2.3.1.1.4) | navigates to `/dashboard/internal-audit?area=staff_certifications[&staffIds=a,b]` — selected staff become the sample; **no back button on the destination** (F-2) |
| Export missing CSV (2.3.1.1.5) | client-side CSV (`missingPersonnelCsv`) of rows with `missing > 0`, using the selection or everyone visible; **it is a CSV, not a PDF** — the tree's ".5.1 PDF Download" is wrong |
| Export pack for selected (2.3.1.1.6) | `listOrgPersonnelFilePack` → signed URLs for each evidence file → new window → `print()` (browser "Save as PDF" is the PDF). Requires a selection. |
| Row (2.3.1.1.7) | click → `/dashboard/employees/$staffId?tab=personnel` (the staffer's Staff file tab). Columns: ☐ · Staff (+ "Deactivated" tag) · Role / codes (role badge, job title, up to 6 service-code chips +N) · Missing · Due soon · On file (counts) |

**Client file (2.3.1.2).** Same shell for clients (`ClientFilePanel`); rows open the client chart → **YET TO BREAK DOWN** (`3.1.???`). **Agency file (2.3.1.3)** → `AgencyFilePanel` with its own sub-tabs → **YET TO BREAK DOWN**.

**Reports (2.3.1.1.2) — `/dashboard/reports`.** Tabs **Standard Reports** and **Behavior Supports**. Standard: five cards each with **Download CSV** — Compliance Summary, Training Completion, Module Completions (from `course_assignments` / `user_training_progress`), Overdue Training (`staff_other_assignments` type=training), Certification Renewals (`external_certifications` with expiry). Behavior Supports: filters (Client, Behaviorist, BC code, From, To) → Export CSV / Export PDF → results list. No back button (F-2).

**Practice audit (2.3.1.1.4) — `/dashboard/internal-audit`.** Run audit now · Export · DSPD-style sample (pick clients / pick staff, "DSPD requested" toggles) · other scope filters (Client, Area, Service code, From, To) · summary stats (Audit readiness, Critical gaps, Needs attention, Minor) · Findings by area (Documentation, Daily Logs, EVV / Timesheets, Billing & Authorizations, Staff Certifications, Requirements Engine, External Attestations) · Findings list with "Open staff file" links back to `/dashboard/employees/$staffId?tab=personnel`. Backend `internal-audit.functions.ts`. Not reachable in the mocked harness (unmocked server fn) → **UNTESTED**.

### 5.B Annotated wireframe

```
HR Admin tab
┌ HR Admin                                        [Open Staff file] [⚙ HR Settings] ┐ 2.3.1 / 2.3.2
│ Other trainings and HR settings. File status for every staffer lives on Staff file. │ (underlined link = same target as button)
│ ┌ Other Trainings & Tasks (rollup)     [0 NECTAR proposals] [0 open] [0 done] ┐    │ 2.3.3 / 2.3.4 / 2.3.5
│ │ No assignments yet.                                                        │    │ 2.3.3.1
│ └────────────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────────────┘

Staff file (/dashboard/compliance?tab=staff)               State Audit · Reports  ← 2.3.1.1.1 / 2.3.1.1.2
┌ [Staff file] [Client file] [Agency file] ─────────────────────────────────────────┐ 2.3.1.1 / .2 / .3
│ Staff file — org-wide file status from the same obligation instances…             │
│ (amber) 2 certificates awaiting review  · Jane · CPR   [Export exam] [Review]      │
│ (next action card)  (scope note)                                                   │
│ 🔍 Search staff, role, or codes…   [Practice audit] [Export missing CSV] [Export pack for selected] │ 2.3.1.1.3–6
│ Showing 12 of 12. Practice audit opens Internal Audit for the org…                 │
│ ☐ │ STAFF          │ ROLE / CODES          │ MISSING │ DUE SOON │ ON FILE │        │ 2.3.1.1.7.x
│ ☐ │ Jake Probert   │ [EMPLOYEE] DSP HHS SLN│   (3)   │   (0)    │   (0)   │ → profile Staff file tab │
└────────────────────────────────────────────────────────────────────────────────────┘

HR Settings (/dashboard/hr-admin/settings)
┌ [← HR Admin]  HR Settings                                                          ┐ back → standalone /dashboard/hr-admin (not the hub)
│ ✦ Staff types & applicability (HR Settings)   [Run NECTAR proposal] ([Confirm all]) │
│ ┌ No proposal yet. Click Run NECTAR proposal to derive staff types… ┐              │ ← the "EMPTY PAGE"
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.C User stories

| ID | As a… | I want… | Pass criteria |
|---|---|---|---|
| US-HR1 | Compliance lead | one place to see who is missing what | Staff file table shows every member with Missing / Due soon / On file counts that equal the counts on that person's Staff file tab; search narrows by code (e.g. "HHS"). |
| US-HR2 | Compliance lead | to pull an auditor pack for three staff | Check three rows → Export pack for selected → a print window lists each evidence file grouped by staffer; with nothing checked the button toasts "Select staff to export a pack." |
| US-HR3 | Compliance lead | to export gaps | Export missing CSV downloads `personnel-file-missing-YYYY-MM-DD.csv` containing only rows with Missing > 0; if none, toast "No missing items in the current selection." |
| US-HR4 | Owner | to run a practice audit on a sample | Select staff → Practice audit → Internal Audit opens pre-filtered to those staff with area = Staff Certifications → Run audit now populates findings. |
| US-HR5 | Owner | to define staff types once | HR Settings → Run NECTAR proposal → types and mapping appear → Confirm all → requirements that don't apply to a type render N/A on that staffer's Staff file. |
| US-HR6 | Supervisor | to see open trainings and tasks | Rollup badges match counts in Training → Other assignments; safety-critical rows sort first. |

### 5.D Status — HR Admin

| Tree ID | Element | Status | Note |
|---|---|---|---|
| 2.3 | HR Admin tab | **EXACTLY WHAT WE WANT** (renders, no errors) | thin launcher; "move this tab?" is a product decision |
| 2.3.1 | Staff file link + Open Staff file button | **EXACTLY WHAT WE WANT** | same target, as the tree notes |
| 2.3.1.1.1 | State Audit link | **YET TO BREAK DOWN** | `4.4.???` |
| 2.3.1.1.2 | Reports page | **UNTESTED** / **NEEDS ATTENTION** | renders with 5 CSV buttons in mocked run; no back affordance (F-2) |
| 2.3.1.1.3 | Search | **EXACTLY WHAT WE WANT** | client filter incl. codes |
| 2.3.1.1.4 | Practice audit → Internal Audit | **UNTESTED** / **NEEDS ATTENTION** | F-2 no back; unmocked in harness |
| 2.3.1.1.5 | Export missing CSV | **EXACTLY WHAT WE WANT** | tree says PDF — it is CSV (correct the tree) |
| 2.3.1.1.6 | Export pack for selected | **UNTESTED** | signed URLs + print window |
| 2.3.1.1.7 | Staff table → profile | **EXACTLY WHAT WE WANT** | probe renders buttons; row links to `?tab=personnel` |
| 2.3.1.2 | Client file | **YET TO BREAK DOWN** | `3.1.???` |
| 2.3.1.3 | Agency file | **YET TO BREAK DOWN** | |
| 2.3.2 | HR Settings "empty page" | **NEEDS ATTENTION** | F-2/F-3: back goes to standalone route; empty until NECTAR proposal is run; naming collides with Roster → Settings |
| 2.3.3–2.3.5 | Rollup, 0 open / 0 done | **EXACTLY WHAT WE WANT** | counts only confirmed rows |

---

## 6. Surface 2.4 — Employee Loans

### 6.A Functional spec

**Purpose.** Admin-only record and e-signature of loan/advance agreements between the org and a staffer. Tables (migration `20260702041149`): `employee_loans` (agreement + status), `employee_loan_entries` (ledger lines), `employee_loan_signatures` (signed record: name, image, IP, method, time), `employee_loan_signature_tokens` (one-time signing links). RLS on all four: `is_org_admin_or_manager`, which is `role IN ('admin','program_manager','manager')` as of migration `20260825020000`, so Owners, Program Managers and Supervisors can read/write. The tab gate is `view_staff_records` (F-10, withdrawn; confirm live with Q7).

**Panel (2.4.1–2.4.3).**

| Element | Behaviour |
|---|---|
| Search employees… (2.4.2.1) | filters the Select below by name/email (members + profiles loaded client-side) |
| Select employee ▾ (2.4.2.2) | required before New loan enables |
| ＋ New loan (2.1.2.3 in the tree — should be 2.4.2.3) | opens `EmployeeLoanEditor` inline (replaces the ledger view; **Back** returns) |
| Agreements on file (2.4.3) | `listEmployeeLoans` → table Employee · Borrower (on agreement) · Date · Status badge · **Open** |

**Editor (new or existing).** Header title *"New Employee Loan Agreement"* / *"Employee Loan Agreement"*; subtitle always prints **"DRAFT — pending legal review"** as static copy even after signature (F-11), followed by badges *Locked (signed)*, *Signed by <name>*, *Awaiting signature (<email>)* when applicable.

| Button | Shown when | Behaviour |
|---|---|---|
| Back (…1.1) | always | `onClose()` → ledger; unsaved edits are lost silently |
| Download PDF (…1.2) | always | client-side `downloadEmployeeLoanPdf` of the **current form values** + ledger balance + signature block if signed → `employee-loan-<borrower>.pdf`. For a signed loan this is the signed document (tree 2.1.2.3.1.2.1). |
| Send for e-signature (…1.3) | existing loan, not locked | disabled unless *Employee email* is filled (no hint) → `SendForSignatureDialog`: Signer name, Signer email, Cancel, Send for signature → `sendEmployeeLoanForSignature` creates a token, tries to email the link, and shows the link for copy + Done. A pending token shows an amber card with **Void link**. |
| Save (…1.4 / …3) | not locked | `upsertEmployeeLoan` (`id` undefined → insert then close; else update) → toast "Loan saved" |
| Delete (…1.5) | existing loan | browser `confirm("Delete this agreement and ledger?")` → `deleteEmployeeLoan` (cascades entries/tokens/signatures) |

**Form sections** (all inside one `<fieldset disabled={isLocked}>` — locked when `status ∈ {signed, active}`):

| Tree | Section | Fields / defaults |
|---|---|---|
| …1.4 | Parties & Date | Employee (borrower) · Employee email (for e-signature — not in tree, required for Send) · Employer (lender, defaults to org name) · Agreement date (today) · Purpose / description |
| …1.5 | Advance terms | Advance amount ($) · Cadence: One-time (default) / Weekly / Biweekly / Monthly |
| …1.6 | Recurring direct payment (optional) | Amount · Cadence: Monthly (default) / Weekly / Biweekly · Due day / detail · Start date · Description |
| …1.7 | Interest | Interest rate (% / year, default 0 = interest-free) · Notes |
| …1.8 | Repayment terms | ＋ Add condition; defaults: "Deducted from next available paycheck(s) with the Employee's written consent", "In full upon termination of employment (voluntary or involuntary)"; each row has 🗑; Maturity date; Method of repayment (free text, placeholder "Payroll deduction / direct deposit / check") |
| …1.9 | Acknowledgments | ☑ (default on) "Employee's decision to accept or decline this loan will not affect… employment status or benefits." |
| …1.10 | Signature parties | ＋ Add party (adds role "Witness"); defaults Employee (borrower name) and Employer (lender name); each: Role · Name · Title · 🗑. **These are display/PDF lines only — the e-signature flow signs one token per send, so extra parties (lawyer, SCE, payee) do not get their own signing link** (F-12; matches the tester's request). |
| — | Electronic signature on file | read-only card when a signature exists: signer, email, method, signed at, IP, image |
| — | Loan Ledger (existing loans only) | add entry: date · kind (Advance / Direct payment / Repayment / Adjustment) · amount · note → `addEmployeeLoanEntry`; running balance via `computeRunningBalance`; 🗑 per entry |
| …1.11 | Internal notes | textarea, locked with the rest |

**Open by status (2.4.3.5).** Same editor; `draft` → editable with Save / Send / Delete; `signed` or `active` → fieldset disabled, Save and Send hidden, Back / Download PDF / Delete remain (matches 2.4.3.5.2.1.x). Ledger entries remain editable after signing (by design: repayments happen after signature).

### 6.B Annotated wireframe

```
┌ Employee Loan Ledger ─────────────────────────────────────────────────────────────┐ 2.4.1
│ Admin-only recordkeeping and e-signature… captured under the U.S. E-SIGN Act…      │
│ ┌ Start a new loan agreement ───────────────────────────────────────────────────┐ │ 2.4.2
│ │ [🔍 Search employees…] [Select employee… ▾] [＋ New loan (disabled until pick)] │ │ 2.4.2.1 / .2 / .3
│ └───────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Agreements on file ───────────────────────────────────────────────────────────┐ │ 2.4.3
│ │ EMPLOYEE │ BORROWER (ON AGREEMENT) │ DATE       │ STATUS  │        [Open]      │ │ 2.4.3.1–5
│ │ Jake P.  │ Jake Probert            │ 2026-09-01 │ [draft] │        [Open]      │ │
│ └───────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘

Editor (replaces the ledger in place):
┌ Employee Loan Agreement                 [Back] [⬇ Download PDF] [✉ Send for e-signature] [💾 Save] [🗑 Delete] ┐
│ DRAFT — pending legal review  [🔒 Locked (signed)] [✓ Signed by …] [✉ Awaiting signature (…)]                  │
│ (amber) Signing link sent to … — expires …                                                   [Void link]        │
│ ▢ Parties & Date  ▢ Advance terms  ▢ Recurring direct payment  ▢ Interest  ▢ Repayment terms                    │
│ ▢ Acknowledgments  ▢ Signature parties [＋ Add party]  ▢ Electronic signature on file  ▢ Loan Ledger  ▢ Internal notes │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.C User stories

| ID | As a… | I want… | Pass criteria |
|---|---|---|---|
| US-L1 | Owner | to draft an advance for a staffer | Select employee → New loan → borrower/lender/date pre-filled → enter amount → Save → toast → back on ledger with status *draft*. |
| US-L2 | Owner | to get it signed remotely | Open draft → Send for e-signature → dialog pre-fills borrower name/email → Send → toast + copyable link → amber "Awaiting signature" card; the staffer opens the link, signs; loan shows *Signed by*, status locks, Save/Send disappear. |
| US-L3 | Owner | to keep the ledger current | On a signed loan add Repayment 100.00 → running balance drops by 100 → PDF includes the ledger. |
| US-L4 | Owner | to retire a bad draft | Delete → confirm → agreement gone from ledger; a signed agreement can also be deleted (no extra guard — flag for legal). |

### 6.D Status — Employee Loans

| Tree ID | Element | Status | Note |
|---|---|---|---|
| 2.4 | Tab renders | **EXACTLY WHAT WE WANT** | mocked probe: search, select, New loan, empty ledger |
| 2.4.2.x / 2.1.2.3.x | New loan form fields | **EXACTLY WHAT WE WANT** (fields/defaults match tree) / **UNTESTED** (live save) | Advance cadence order in UI is One-time, Weekly, Biweekly, Monthly |
| 2.1.2.3.1.2 | Download PDF | **UNTESTED** | client-side PDF |
| 2.4.3.5.1.1.3 | Send for e-signature | **UNTESTED** / **NEEDS ATTENTION** | F-12 single signer; disabled-without-email has no hint |
| 2.4.3.5.1 / .2 | Open by status | **EXACTLY WHAT WE WANT** | lock logic traced |
| header copy | "DRAFT — pending legal review" | **NEEDS ATTENTION** | F-11 static |
| RLS | Program Manager access | **EXACTLY WHAT WE WANT** (per migrations) / **UNTESTED** (live) | F-10 withdrawn; confirm with Q7 |
| 2.4.3.5.1.1.5 | Delete | **UNTESTED** | browser confirm; also allowed on signed |

---

## 7. Findings (NEEDS ATTENTION), root causes, smallest fixes

| # | Where | What happens now | Root cause | Smallest fix |
|---|---|---|---|---|
| **F-1** | Roster → Settings (Staff fields) | Toggles appear to save ("Saved" flashes) but do not persist for Program Manager / Supervisor; for Owner they do persist. | `staff-fields-panel.tsx` writes `organizations.feature_config` with a direct client `update`. RLS `"admins update org"` = `has_org_role(id, uid, 'admin')`, so non-Owner rows are filtered → PostgREST returns **no error and 0 rows**; the component only checks `error`, so it shows "Saved". No toast on failure either. | Move the write to a server fn guarded by `assertOrgManager`, or add `.select("id")` and treat an empty result as failure with an error toast. Also disable the sheet for roles that cannot write. |
| **F-2** | HR Settings, Reports, Internal Audit, State Audit | No way back to the Employees hub; HR Settings' back goes to standalone `/dashboard/hr-admin`. | These are top-level routes reached from inside the hub; only HR Settings has a back link and it targets the legacy route. | Point HR Settings back to `/dashboard/hub/employees?tab=hr-admin`; add the same ghost back button to Reports and Internal Audit (or open them in a drawer). |
| **F-3** | Two "settings" | Roster → Settings (intake fields) and HR Admin → HR Settings (staff types/applicability) are unrelated but both read as HR settings. | Different features landed on different surfaces. | Rename the roster sheet "Staff fields" in the button label, or link it from HR Settings. |
| **F-4** | Caseload sheet | Writes `staff_assignments` from the browser; calls the obligation hook with `serviceCodes: []`; hook errors are `console.warn`ed. | Client-side mutation predates the server hooks. | Route through a server fn that inserts and re-evaluates atomically and passes the client's authorized codes (`client_billing_codes`) so obligations by code fire. |
| **F-5** | Hosts detail dialog | Supervisors/PMs (tab visible via `view_staff_records`) open a card and find Status/Notes/Link controls disabled with no message. | `canManage = can("manage_referrals")` (Owner-only by default) while tab visibility is broader. | Show a one-line "Only Owners can edit host cards" note, or gate the tab on the same permission. |
| **F-6** | Add employee → Role | Options read Employee / Manager / Admin; profile and badges use Staff / Supervisor / Owner; Program Manager cannot be chosen at hire. | Hard-coded `SelectItem`s in `add-employee-wizard.tsx`; the roster ROLE column prints the raw enum. | Render from `ROLE_LABEL` and `ROLE_OPTIONS` (same list as the profile). |
| **F-7** | Profile → Back to list / ← Employees | After changing tabs, Back returns to the previous tab instead of the list. | Both buttons call `router.history.back()`; tab changes push history. | Navigate explicitly to `/dashboard/hub/employees` (keep `history.back()` only when the referrer is the roster). |
| **F-8** | Profile → Activity → All | Every EVV row with a status appears twice (Shift + Timesheet). | `ActivityFeed` pushes one item of each kind per `evv_timesheets` row. | Show Timesheet items only when the row is in a payroll status (e.g. approved/submitted), or merge into one line. |
| **F-9** | Profile → Save profile | Four writers run sequentially; if the 3rd fails the first two are already committed and the toast reads as a failure. | `saveMut` is not transactional. | Acceptable for now; document. Long-term: one server fn. |
| **F-10** (withdrawn) | Employee Loans | Originally reported as "Program Manager blocked by RLS". That is incorrect: migration `20260825020000_replace_is_super_admin_with_hive_executive.sql` defines `is_org_admin_or_manager` as `role IN ('admin','program_manager','manager')`. | n/a | None, unless Q7 shows the live function body is missing `program_manager` (that would mean the migration never reached the live DB). |
| **F-11** | Loan editor header | "DRAFT — pending legal review" prints on signed/active loans. | Static string. | Render `values.status` instead. |
| **F-12** | Send for e-signature | Only one signer per send; added Signature parties are PDF text only. | Token model is one signer per token; dialog collects one name/email. | Product decision: multi-party = one token per party + "all signed" state. Tester's request noted. |
| **F-13** | e2e harness (not product) | `e2e/clients-staff-roster.spec.ts` failed 5/8 on `main` before this work because `mock-hive.ts` did not mock `getAgencySetupStatus` / `loadEmployeeScope` (both added after the harness) and the wizard step-2 copy had changed. | Harness drift. | Fixed in this PR (mocks + copy). Two remaining failures are in the **Clients** chart (Files tab, empty state) — outside this tab. |

Also observed, not defects: the invite-step "Set up Evidence pack" button navigates by full page load to `/dashboard/evidence?tab=staff&wizard=1&person=<id>` (**YET TO BREAK DOWN**); Deactivate/Delete/Uninvite use native `confirm()` in two places and a typed-name dialog in one.

---

## 8. Self-test log (what was actually run)

Environment: fresh `npm ci`, Node 22, Chromium (Playwright). No live Supabase credentials are available to the agent, so all browser tests use the mocked Supabase harness (`e2e/helpers/mock-hive.ts`).

| Check | Command | Result |
|---|---|---|
| Unit — roster filtering, roster upload parsing/classification, staff file status labels, profile identity lock, permission `can()`, permission toggle planner, permission groups (52/20/11=83), scope, compliance nav, invite result parsing, custom-field delete | `node --test --experimental-strip-types src/lib/{employee-roster,employee-roster-upload,staff-obligation-files,staff-profile-identity,permissions-can,staff-permission-toggles,profile-permission-groups,obligations/scope,compliance-nav,invite-send-result,custom-field-delete}.test.ts` | **106 / 106 pass** |
| Build (regenerates `routeTree.gen.ts`) | `npm run build` | **exit 0**; `src/routeTree.gen.ts` unchanged |
| Mocked e2e — Employees list, Active/Inactive, columns, row → profile bound to route id | `playwright test --config=e2e/configs/playwright.roster.config.ts -g "Employees list"` | **pass** (after harness fix F-13) |
| Mocked e2e — Add employee wizard step 1 → step 2 → Send 1 invite → invitations page | same config, `-g "Add employee"` | **pass** (after harness fix) |
| Mocked e2e — DSP persona cannot open the roster | same config, test 6 | **pass** |
| Mocked render probe — hub tabs roster / hosts / hr-admin / loans, HR Settings, Staff file, Reports | temporary probe (removed) | all render with **no console errors**; Internal Audit crashes in the harness only because its server fn is unmocked |

Remaining e2e failures in that spec (Clients chart "Files" tab; empty-clients copy) are outside the Employees tab and were left untouched.

---

## 9. SQL handoff — confirm the live shape (run in Lovable SQL editor; Clear before each paste)

Each query is truncation-proof (aggregated to one row). Paste results back into the tracker.

```sql
-- Q1. Roster health: members vs profiles for the active org (replace :org)
select count(*) filter (where m.active) as active_members,
       count(*) filter (where not m.active) as inactive_members,
       count(*) filter (where p.id is null) as members_without_profile,
       count(*) filter (where p.account_status = 'archived' and m.active) as archived_but_member_active,
       count(*) filter (where p.must_change_password) as must_change_pw
from organization_members m
left join profiles p on p.id = m.user_id
where m.organization_id = ':org';

-- Q2. Staff-fields settings actually persisted? (F-1)
select id, feature_config->'staff_intake_fields' as staff_intake_fields
from organizations where id = ':org';

-- Q3. Who can write organizations (F-1): list UPDATE policies
select string_agg(policyname || ' :: ' || coalesce(qual,'') , ' | ')
from pg_policies where schemaname='public' and tablename='organizations' and cmd in ('UPDATE','ALL');

-- Q4. Scope columns live? (2.1.4.4.2)
select string_agg(table_name || '.' || column_name, ', ')
from information_schema.columns
where table_schema='public'
  and ((table_name='profiles' and column_name in ('scope_group_id','lead_group_id'))
    or table_name in ('staff_groups','staff_group_members'));

-- Q5. Permission overrides present for the org (2.1.4.4.3)
select count(*) as overrides, string_agg(distinct permission, ', ') as perms
from user_permission_overrides where organization_id = ':org';

-- Q6. Live role matrix differs from DEFAULT_MATRIX? (Appendix A)
select role, count(*) as granted, string_agg(permission, ',' order by permission)
from role_permissions where organization_id = ':org' and granted group by role;

-- Q7. Loans RLS helper includes program_manager? (confirms F-10 is withdrawn)
select pg_get_functiondef('public.is_org_admin_or_manager(uuid,uuid)'::regprocedure);

-- Q8. Employee loans + signature tokens for the org (2.4)
select l.status, count(*) as loans,
       count(*) filter (where exists (select 1 from employee_loan_signatures s where s.loan_id = l.id)) as signed,
       count(*) filter (where exists (select 1 from employee_loan_signature_tokens t where t.loan_id = l.id and t.used_at is null and t.expires_at > now())) as awaiting
from employee_loans l where l.organization_id = ':org' group by l.status;

-- Q9. Host cue cards by status + linked-staff + latest cert (2.2)
select c.status, count(*) as cards,
       count(*) filter (where c.linked_staff_user_id is not null) as also_dsp,
       count(*) filter (where not exists (select 1 from host_home_certifications h where h.hhp_cue_card_id = c.id)) as no_cert
from hhp_cue_cards c where c.organization_id = ':org' group by c.status;

-- Q10. Staff-file counts for one staffer should equal the matrix row (2.3.1.1.7 vs 2.1.4.5)
select i.status, count(*) 
from company_obligation_instances i
join company_obligation_instance_assignees a on a.instance_id = i.id
where i.organization_id = ':org' and a.staff_id = ':staff' group by i.status;
```

---

## Appendix A — Permission catalogue as rendered on the profile (83)

Default grants from `DEFAULT_MATRIX` (`src/lib/rbac.ts`). Live values come from `role_permissions` (Q6) and per-user `user_permission_overrides` (Q5).

### People & Files (52) — tree 2.1.4.4.3.1.1 … .52

| Permission | Key | Owner | Program Manager | Supervisor | Staff | Committee |
|---|---|---|---|---|---|---|
| Invite staff | `invite_staff` | yes | yes | yes | — | — |
| View staff records | `view_staff_records` | yes | yes | yes | — | — |
| Edit staff records | `edit_staff_records` | yes | yes | — | — | — |
| Manage staff roles | `manage_staff_roles` | yes | — | — | — | — |
| Deactivate staff | `deactivate_staff` | yes | — | — | — | — |
| View staff documents | `view_staff_documents` | yes | yes | yes | — | — |
| Upload staff documents | `upload_staff_documents` | yes | yes | yes | — | — |
| Approve staff documents | `approve_staff_documents` | yes | yes | — | — | — |
| View clients | `view_clients` | yes | yes | yes | — | — |
| Edit client records | `edit_client_records` | yes | yes | yes | — | — |
| Manage client intake | `manage_client_intake` | yes | yes | — | — | — |
| View client medical info | `view_client_medical` | yes | yes | yes | — | — |
| Edit client medical info | `edit_client_medical` | yes | — | — | — | — |
| View client documents | `view_client_documents` | yes | yes | yes | — | — |
| Manage client documents | `manage_client_documents` | yes | yes | yes | — | — |
| Manage client goals | `manage_client_goals` | yes | yes | yes | — | — |
| Edit shift notes | `edit_shift_notes` | yes | yes | yes | — | — |
| Approve shift notes | `approve_shift_notes` | yes | yes | — | — | — |
| View daily logs | `view_daily_logs` | yes | yes | yes | — | — |
| Approve daily logs | `approve_daily_logs` | yes | yes | — | — | — |
| Manage forms | `manage_forms` | yes | — | — | — | — |
| View form submissions | `view_form_submissions` | yes | yes | yes | — | — |
| Approve form submissions | `approve_form_submissions` | yes | yes | — | — | — |
| View compliance dashboard | `view_compliance_dashboard` | yes | yes | yes | — | — |
| File staff documents | `file_staff_documents` | yes | yes | yes | — | — |
| Manage obligations | `manage_obligations` | yes | yes | — | — | — |
| View audit trail | `view_audit_trail` | yes | — | — | — | — |
| View incidents | `view_incidents` | yes | yes | yes | — | — |
| Manage incidents | `manage_incidents` | yes | yes | yes | — | — |
| Export incident reports | `export_incident_reports` | yes | — | — | — | — |
| Manage medications | `manage_medications` | yes | — | — | — | — |
| View HRC | `view_hrc` | yes | yes | yes | — | yes |
| Manage HRC | `manage_hrc` | yes | yes | — | — | yes |
| Manage organization settings | `manage_organization_settings` | yes | — | — | — | — |
| Manage service codes | `manage_service_codes` | yes | — | — | — | — |
| View analytics | `view_analytics` | yes | yes | yes | — | — |
| Export reports | `export_reports` | yes | yes | — | — | — |
| Manage permissions | `manage_permissions` | yes | — | — | — | — |
| Manage roles & permissions (legacy) | `manage_roles` | yes | — | — | — | — |
| Assign training | `assign_training` | yes | — | yes | — | — |
| Create courses | `create_courses` | yes | — | — | — | — |
| Edit courses | `edit_courses` | yes | — | — | — | — |
| Manage certifications | `manage_certifications` | yes | — | — | — | — |
| Manage training programs | `manage_programs` | yes | — | — | — | — |
| Approve external certifications | `approve_external_certs` | yes | — | yes | — | — |
| View team reports | `view_team_reports` | yes | — | yes | — | — |
| Manage organization (legacy) | `manage_organization` | yes | — | — | — | — |
| View platform metrics | `view_platform_metrics` | yes | — | — | — | — |
| Manage all organizations | `manage_all_orgs` | yes | — | — | — | — |
| View referrals (CRM) | `view_referrals` | yes | — | — | — | — |
| Manage referrals (CRM) | `manage_referrals` | yes | — | — | — | — |
| Send emails (Resend rail) | `send_emails` | yes | — | — | — | — |

### Schedule & Money (20) — tree 2.1.4.4.3.2.1 … .20

| Permission | Key | Owner | Program Manager | Supervisor | Staff | Committee |
|---|---|---|---|---|---|---|
| View schedule | `view_schedule` | yes | yes | yes | — | — |
| Create shifts | `create_shifts` | yes | yes | yes | — | — |
| Edit shifts | `edit_shifts` | yes | yes | yes | — | — |
| Delete shifts | `delete_shifts` | yes | yes | — | — | — |
| Approve shift swaps | `approve_shift_swaps` | yes | yes | yes | — | — |
| Manage recurring shifts | `manage_recurring_shifts` | yes | yes | — | — | — |
| View team timesheets | `view_team_timesheets` | yes | yes | yes | — | — |
| View all timesheets | `view_all_timesheets` | yes | yes | — | — | — |
| Approve timesheets | `approve_timesheets` | yes | yes | yes | — | — |
| Edit timesheets | `edit_timesheets` | yes | yes | — | — | — |
| Export EVV data | `export_evv` | yes | yes | — | — | — |
| View billing | `view_billing` | yes | yes | — | — | — |
| Manage billing | `manage_billing` | yes | — | — | — | — |
| View payroll | `view_payroll` | yes | yes | — | — | — |
| Manage payroll | `manage_payroll` | yes | — | — | — | — |
| View financial reports | `view_financial_reports` | yes | — | — | — | — |
| Export financial reports | `export_financial_reports` | yes | — | — | — | — |
| View Financial — Gross | `view_financial_tns_gross` | yes | — | — | — | — |
| View Financial — RHS | `view_financial_rhs` | yes | — | — | — | — |
| View Financial — Employees | `view_financial_employees` | yes | — | — | — | — |

### Staff Phone Permissions (11) — tree 2.1.4.4.3.3.1 … .11

| Permission | Key | Owner | Program Manager | Supervisor | Staff | Committee |
|---|---|---|---|---|---|---|
| View own timesheets | `view_own_timesheets` | yes | yes | yes | yes | — |
| Submit shift notes | `submit_shift_notes` | yes | yes | yes | yes | — |
| Submit daily logs | `submit_daily_logs` | yes | yes | yes | yes | — |
| Submit forms | `submit_forms` | yes | yes | yes | yes | — |
| Complete obligations | `complete_obligations` | yes | yes | yes | yes | — |
| Report incidents | `report_incidents` | yes | yes | yes | yes | — |
| View eMAR | `view_emar` | yes | yes | yes | yes | — |
| Submit eMAR | `submit_emar` | yes | yes | yes | yes | — |
| Upload external certifications | `upload_external_certs` | yes | — | yes | yes | — |
| View own training | `view_own_training` | yes | — | yes | yes | — |
| View certifications | `view_certifications` | yes | — | yes | yes | — |

(The tree's "View one timesheets" is "View own timesheets".)

---

## Appendix B — Tables and server functions touched by this tab

| Table | Created in migration | Used by |
|---|---|---|
| `organization_members`, `profiles`, `invitations`, `organizations.feature_config` | `20260521183750`, `20260531203157` | roster, wizards, settings, profile |
| `staff_assignments` | `20260523235712` | caseload sheet, staff-file matrix codes |
| `role_permissions`, `user_permission_overrides`, `permission_audit_log`, `scope_assignments` | `20260817140000_permission_system_rebuild` | profile permissions |
| `role_change_audit_log` | `20260817130000` | hire, role changes |
| `company_obligations`, `company_obligation_instances`, `_assignees`, `_completions`, `staff_groups`, `staff_group_members` | `20260813233000` | Staff file tab, matrix, scope |
| `employee_documents` + storage | face sheet ship |
| `evv_timesheets`, `form_submissions`, `incident_reports` | activity tab (read-only) |
| `hhp_cue_cards` | `20260612135044` | Hosts |
| `host_home_certifications`, `host_home_cert_concerns` | `20260614013028` | host cert badge/panel |
| `employee_loans`, `employee_loan_entries`, `employee_loan_signatures`, `employee_loan_signature_tokens` | `20260702041149` | Employee Loans |
| `staff_other_assignments` | training | HR Admin rollup |

| Server function | File | Called from |
|---|---|---|
| `createEmployeeManually`, `applyEmployeeRosterRow`, `adminResetEmployeePassword`, `hireEmployeeInternal` | `src/lib/employees.functions.ts` | wizards, roster ⋯ |
| `archiveEntity`, `restoreEntity`, `deleteEntity` | `src/lib/lifecycle.functions.ts` | roster ⋯ |
| `createInvitation`, `resendInvitation`, `revokeInvitation` | `src/lib/invitations.functions.ts` | wizards, pending invitations |
| `onStaffHiredInternal`, `onStaffAssignmentCreated`, `onStaffAssignmentRemoved` | `src/lib/staff-assignment-hooks.functions.ts` | hire, caseload |
| `setMemberGrants` | `src/lib/team-access.functions.ts` | profile role |
| `saveStaffPermissionToggles` | `src/lib/permissions.functions.ts` | profile permissions |
| `loadEmployeeScope`, `setEmployeeScope` | `src/lib/obligations/scope.functions.ts` | profile scope |
| `generateEmployeeFaceSheetFn` | `src/lib/employee-face-sheet.functions.ts` | face sheet |
| `listStaffObligationInstances`, `recordCompletion`, `listPendingCertReviews` | `src/lib/company-obligations.functions.ts` | Staff file tab, Staff file panel |
| `listOrgPersonnelFileMatrix`, `listOrgPersonnelFilePack` | `src/lib/personnel-file-matrix.functions.ts` | Staff file matrix |
| `listHhpCueCards`, `createHhpCueCard`, `updateHhpCueCard` | `src/lib/hhp-cue-cards.functions.ts` | Hosts |
| `listOrgOtherAssignments` | training functions | HR Admin rollup |
| `listStaffTypeProposal`, `proposeStaffTypesAndMapping`, `upsertStaffType`, `deleteStaffType`, `updateRequirementApplicability`, `confirmAllApplicability` | `src/lib/staff-types.functions.ts` | HR Settings |
| `listEmployeeLoans`, `getEmployeeLoan`, `upsertEmployeeLoan`, `deleteEmployeeLoan`, `addEmployeeLoanEntry`, `deleteEmployeeLoanEntry`, `sendEmployeeLoanForSignature`, `voidEmployeeLoanSignatureToken` | `src/lib/employee-loans.functions.ts` | Employee Loans |
| `getAgencySetupStatus` | `src/lib/agency-setup-gate.functions.ts` | hub gate |
