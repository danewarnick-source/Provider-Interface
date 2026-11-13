# Plan: one source for "who is the host"

Status: **done** (live since PR #504; Phase B applied Nov 13) (Nov 13, 2026). Answers: yes to 1–3; the Finances host names were test entries (no data move); hosts are team members with a login. Decision: the host is the host home's lead (`docs/decisions.md`).

## 1. Job
An admin records a host home once: the home, the host family (its lead) and who lives there. Clients, Daily Logs, Finances and later the scheduler's host-away flow all read that one record. Today the host is stored in three places that disagree.

## 2. What's there today (live, Nov 13)
| Fact | Stored in | Read by |
|---|---|---|
| Is this home a host home | `teams.setting = 'host_home'` **and** `teams.team_type` (`rhs_home` / `day_program` / `other`; no host value) | Homes page uses `setting`; scheduler Part B1 uses `team_type` |
| Who leads a home | `teams.manager_id` (→ `profiles`) **and** a "Manager" role in `home_staff_designations` | Scheduler (B1) uses `manager_id`; the home page shows the Manager role |
| Who a client's host is | (1) assigned staff whose Position is Host Home Provider; (2) `hhs_host_home_settings.hhp_name`, free text; (3) the client's home | (1) Daily Logs missing notes, (2) Finances › Host home |
| Where a client lives | `clients.team_id` → `teams` | Clients tab (Home field), home page Residents |

True North's live data:
- 2 homes: Maple House and Harper Host Home. Neither has a lead in either place.
- Only Riley has a home (Harper Host Home).
- Finances names hosts for Blake ("Harvey Alisa") and Tommy ("Dane Warnick").

## 3. The change (one PR into `main`)
| Area | After |
|---|---|
| Home kind | One column: `teams.team_type` gains `host_home`. Existing `setting = 'host_home'` rows are copied over. `setting` is retired in a Phase B file *(question 1)* |
| Home lead | One field: `teams.manager_id`. The home page gets a **Lead** field, shown as **Host** on a host home *(question 2)* |
| Client's host | Read from the client's home: `clients.team_id` → `teams.manager_id`. Never typed in, never inferred from Position |
| Clients tab | A host home client's profile header shows "Lives with Harvey A. · Harper Host Home". Read-only, with a link to the home |
| Daily Logs | A missing host home note belongs to the client's home's host. If the home has no host, it belongs to the client only (as today), with a "Set host" link |
| Finances › Host home | The Host column shows the home's host, read-only, with a link to the home. The free-text name box is removed. The daily rate stays (it's pay, not who the host is) |
| Evidence | Unchanged. A Host Home Provider Position still adds the host home Evidence pack. That rule is about training, not about who hosts whom |

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Home page › **Kind** (Group home / Host home / Day program / Other) | Saves `teams.team_type` | Hidden for staff without Homes edit access | Toast "Home saved"; the Lead label changes to Host on a host home |
| Home page › **Lead** / **Host** picker | Lists active team members; saves `teams.manager_id` | Disabled with "Add the host as a team member first" when no active members | Toast "Host saved"; the name shows in place |
| Home page › **Remove lead** | Clears `manager_id` after a confirm that says which clients will have no host | Hidden when no lead | Toast "Host removed" |
| Client profile › "Lives with …" | Opens that home's page | Shown only when the client's home is a host home | Home page |
| Client profile › **+ Set host** | Opens the home page with the Host picker focused | Shown only when the client's host home has no lead | Home page, picker focused |
| Daily Logs › missing note row › **Set host** | Same as above | Shown only when the client's host home has no lead | Home page, picker focused |
| Finances › Host home › Host name | Opens the home page | Shows "No host set" when there's no lead | Home page |

## 5. Data
- **Migration (applied live, compatible with `main`):** allow `team_type = 'host_home'` and copy `setting = 'host_home'` homes to it.
- **Data move:** for each client named in `hhs_host_home_settings.hhp_name` *(question 4)*, set the client's home and that home's lead, after Dane confirms the names.
- **Phase B file (after merge, when Dane says):** drop `hhs_host_home_settings.hhp_name` and `teams.setting`.
- **Regenerate** `types.ts`.

## 6. Delete
- `hhp_name` reads and writes in `dashboard.financial.host-home.tsx` and `financial-host-home.functions.ts`.
- The Position-based host check in `daily-log-missing.ts` / `daily-log-missing.functions.ts` (`isHost`). `isHostHomeProviderPosition` stays only for the Evidence pack rule.
- Every read of `teams.setting` (homes page, homes board, scheduler location type), replaced by `team_type`.
- The "Manager" role as a lead source, if Dane agrees *(question 3)*.
- The scheduler's leftover `locations`-based host-home lookup in `eligibility.functions.ts`, if Part B1 hasn't already deleted it (B1 deletes `eligibility(.functions).ts`).

## 7. Done when (Dane on the Vercel preview)
1. On Harper Host Home, set the Kind to Host home and the Host to a team member. The toast says "Host saved" and the name shows.
2. Riley's profile shows "Lives with <host> · Harper Host Home". Clicking it opens the home.
3. Daily Logs: a missing Riley note names that host. Remove the host, and the row says "Set host".
4. Finances › Host home shows the same host for Riley, with no typed name box. The daily rate still saves.
5. Maple House still reads as a group home everywhere, including the scheduler board.

## 8. Out of scope
- Moving the Homes pages into the Settings menu (they stay where they are; later Settings tab work).
- The host-away flow (scheduler Part B).
- The host home billing grid (notes review, B16–B17).
- Host pay rules.

## Built differently from the plan
- **Daily Logs › "Set host" row:** not built. Daily Logs only lists the signed-in host's own missing notes, so a client with no host never shows there. An admin list of unowned gaps comes with notes review (B16–B17).
- **The host must be on the client's team** (`staff_assignments`) for a missing note to be theirs. That's unchanged from before.
- **Star on the care team** now marks the home's lead (`teams.manager_id`), not whoever has the "Manager" title.
- **Fixed in passing:** the Open shifts panel now handles a shift with no client (team shifts went live with scheduler B1). `types.ts` was regenerated from live and picked up B1/B2's tables.

## Questions for Dane (answered Nov 13)
1. **Home kind:** use `team_type` (add "Host home") and retire the older `setting` column? *Recommended: yes. Two columns for one fact is the same kind of duplicate we're removing.*
2. **Lead label:** call it "Host" on host homes and "Lead" everywhere else? *Recommended: yes.*
3. **"Manager" care-team role:** the home page lets you tag someone "Manager", and that's a second record of who leads a home. Make the Lead field the only one and keep "Manager" as a plain title that the app doesn't act on? *Recommended: yes.*
4. **True North's data:** Finances names Harvey Alisa as Blake's host and Dane Warnick as Tommy's. Are these real or test entries? Who is Riley's host at Harper Host Home?
5. **Hosts need a login:** a host must be a team member to be a lead. Hosts already write daily notes in the app, so they should be. OK?
