# Plan: Settings › Homes

Status: **waiting for Dane's answers and approval** (Nov 13, 2026). Decision: homes live in Settings as agency setup (`docs/decisions.md`).

## 1. Job
An owner or admin sets up each home once:
- its name, kind, lead (the host, on a host home), address and capacity;
- how many staff it needs and when.

Clients, the scheduler and Finances read it from there. This step also removes the duplicate copies that pile up around homes.

## 2. What's there today (live, Nov 13)
| Thing | Where it is now | Problem |
|---|---|---|
| List of homes + **Add home** | `homes-teams-board.tsx` (1,406 lines) at `/dashboard/homes`, linked from the scheduler | The only place a home can be created, and it isn't in Settings |
| Home setup page | `dashboard.homes.$teamId.tsx` (705 lines): name, kind, Host/Lead, residents, care team, resident ratios, B2's "Settings for this home" card, **Delete home** | Mixes setup with other things; **Delete is a hard delete** |
| Staffing needs (staff per time block) | `location_coverage_requirements`, keyed to the old `locations` table | Duplicate home record. **0 rows live** |
| Care team (staff ↔ home with a role) | `home_staff_designations` | Second list of who works at a home. The scheduler's "Not on the team" rule uses client assignments instead. **0 rows live** |
| Resident ratios | `client_ratios`, edited on the homes board | The scheduler reads the ratio from the client's authorization (`client_billing_codes.ratio`), which has **no editor at all**. **0 rows live** in `client_ratios` |
| Residents | `clients.team_id` (the client's Home field) | Owned by Clients, but also edited from the homes board |

Live: 5 homes (True North has 2), 1 `locations` row, 0 home shifts.

## 3. The change (one PR into `main`)
**Settings › Homes** (`/dashboard/settings/homes`), a new card on the Settings page:
- **List:** each home with its kind, lead/host, number of residents and status (Active / Archived). Archived homes are behind a filter. **+ Add home** asks for a name and kind, then opens the home with the name field focused.
- **Home page** (`/dashboard/settings/homes/<home>`), in sections:
  1. **Details:** name, kind, Lead/Host picker (the existing one), address, licensed capacity.
  2. **Residents:** read-only list from each client's Home field. Each name links to the client. **+ Add a resident** opens the client list with a hint to set Home there *(question 1)*.
  3. **Staffing needs** (group homes only, hidden on host homes): rows of days + start/end + staff needed + "awake overnight". **+ Add a time block**, edit in place, remove. Stored on the home.
  4. **Team:** read-only list of team members assigned to the residents (`staff_assignments`), linking to Team members *(question 2)*.
  5. **Scheduling settings for this home:** B2's existing card, moved here.
  6. **Archive home** (⋯ menu): a dialog asks for a reason; the home is kept on record. Refused while anyone still lives there *(question 4)*.

**Clients › Services & billing:** each authorization card gets a **Ratio** field (1:1, 1:2, 1:3, 1:4, 2:1). It's the one ratio the scheduler already reads *(question 3)*.

**Redirects:** `/dashboard/homes` → Settings › Homes; `/dashboard/homes/<home>` → that home in Settings. On the scheduler board, a home's name opens its Settings page until B7 builds the operational home page *(question 5)*.

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Settings › Homes card | Opens the list | Hidden without `agency_settings` view | Homes list |
| + Add home | Dialog: name, kind | Hidden for view-only | "Home added"; the home opens with Name focused |
| Home row | Opens the home | — | Home page |
| Show archived | Toggles archived homes | — | List includes archived, greyed |
| Details fields | Save on blur or select | Read-only for view-only | "Home saved" in place |
| Lead / Host picker | (existing) | (existing) | "Host saved" / "Lead saved" |
| Resident name | Opens the client | — | Client profile |
| + Add a resident | Opens Clients with "Set Home to <home>" hint | Hidden for view-only | Client list |
| + Add a time block | New row in edit mode, Days first | Hidden on host homes or view-only | "Staffing need added" |
| Edit time block (pencil) | Edit in place | Same | "Staffing need saved" |
| Remove time block | Removes it | Same | "Staffing need removed" + Undo |
| Team member name | Opens their profile | — | Team member profile |
| Archive home (⋯) | Dialog with a required reason | Disabled with "Move its residents first" while anyone lives there | "Home archived"; back to the list |
| Restore home (archived home) | Makes it active again | Only on archived homes | "Home restored" |
| Authorization › Ratio | Saves `client_billing_codes.ratio` | Read-only without Clients edit | "Ratio saved" |

## 5. Data
- **Migration (live, safe for `main`):** add `team_id` to `location_coverage_requirements` (→ `teams`) and make `location_id` optional. 0 rows, nothing to move. RLS checked and re-scoped to the home's agency.
- **Phase B (after merge, with Dane's OK) *(question 6)*:** drop `location_coverage_requirements.location_id`, `scheduled_shifts.location_id`, the `locations` table (1 row), `client_ratios` (0 rows), `home_staff_designations` (0 rows), and `clients.admin_hours_per_week` (no reader since B3). `home_designations` stays (CLAUDE.md).
- **Archive** uses `teams.active` (it exists). No new column; the reason goes on the home's audit/notes field if one exists, or a column is proposed in the build.
- **Regenerate** `types.ts`.

## 6. Delete
- `homes-teams-board.tsx` (1,406), `dashboard.homes.tsx` and `dashboard.homes.$teamId.tsx` (705), replaced by redirects plus the new Settings pages (each file ≤ 250 lines, routes ≤ 80).
- The care-team editor, the resident-ratio editor and the hard **Delete home**.
- The scheduler's `location_id` read in `listOpenShifts`.

## 7. Done when (Dane on the Vercel preview)
1. Settings shows a **Homes** card. The list shows Harper Host Home (Host home, host shown) and Maple House (Group home).
2. **+ Add home** → "Test House", Group home: it opens with Name focused and appears in the list.
3. On Test House, add a staffing need (Mon–Fri, 3p–11p, 2 staff) and edit it to 1 staff: both save in place.
4. Archive Test House with a reason: it leaves the list and shows under Show archived. Restore brings it back.
5. Try to archive Harper Host Home while Riley lives there: it's refused with "Move its residents first".
6. On a client's authorization, set Ratio to 1:2: "Ratio saved".
7. Old links (`/dashboard/homes`, a home's old page, a home name on the board) land on the Settings pages.

## 8. Out of scope
- The operational home page with coverage by the hour, away times and Worksheet hours (B7).
- The coverage-gaps tile on the board (stays hidden until B7) *(question 7)*.
- Host-away (B7b).
- Letting scoped schedulers save home shifts (a separate RLS fix) *(question 8)*.

## Questions for Dane
1. **Residents:** set only from the client's Home field (Clients owns it). Settings › Homes shows them read-only with links? *Recommended: yes.*
2. **Care team:** remove the role list (DSP / House Manager / …) and show the home's team as "everyone assigned to its residents", read-only? The role labels table itself stays. *Recommended: yes.*
3. **Ratio:** one ratio per authorization, edited on the client's authorization card, and the homes-board ratio editor goes? *Recommended: yes.*
4. **Archive, never delete,** and refuse to archive while residents still live there? *Recommended: yes.*
5. **The old home page** redirects to Settings › Homes until B7 builds the operational home page (coverage, away times, Worksheet hours) opened from the board? *Recommended: yes.*
6. **Phase B cleanup** after merge: drop the old `locations` table and pointers, `client_ratios`, `home_staff_designations`, and `clients.admin_hours_per_week` (all empty or unused)? *Recommended: yes.*
7. **Coverage-gaps tile:** keep it hidden until B7, even though staffing needs now live on the home? *Recommended: yes. B7 builds coverage by the hour and turns the tile on with it.*
8. **Scoped schedulers and home shifts:** fix the database rule now (a small separate PR), or wait until a scoped scheduler needs it? *Recommended: wait. True North's schedulers are agency-wide.*
