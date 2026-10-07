# Clients polish — C1 and C2

Read `00-START-HERE.md` first.

## C1 — Shared layout: cards, buttons, header and side menu

**Goal:** one clean, organized look for the whole client profile, using today's colors. Jeff picked "Option C: soft panel" from the "Client Profile Refresh" design canvas; it's described in full below, so you don't need to open the canvas.

### 1. One card component

Create `src/components/clients/profile/cards/section-card.tsx` (`SectionCard`), and use it for **every** card in the client profile:

- Frame: card background (`--hive-surface`), 1 px border (`--hive-border`), large rounded corners (`rounded-2xl`), padding 24 px (20 px on phones).
- Header row: a 44 px rounded **icon tile** tinted by a `tone` prop, then the **title** (18 px, semibold) with a **one-line description** under it (13 px, muted), then an **actions** slot on the right.
- Tones map to existing tokens only: `profile` → gold soft / ink, `info` → `--hive-info-soft` / `--hive-info-fg`, `ok` → `--hive-ok-soft` / `--hive-ok-fg`, `danger` → `--hive-danger-soft` / `--hive-danger-fg`, `neutral` → `--hive-muted-surface` / ink.
- Props: `icon`, `tone`, `title`, `description` (required: every card says what it's for), `actions`, `children`, optional `id` for scroll targets.
- Also add the small shared pieces the later prompts reuse: `InfoTile` (white tile: small muted label, bold value, optional link), `FieldGrid` (label/value pairs in a 2-column grid that becomes 1 column on phones; replaces the old `Row` lists), `StatusTag` (pill in a tone), and `EmptyState` (one sentence + the button that fixes it).

Then replace `CardShell` (`cards/card-shell.tsx`) and every direct use of `@/components/ui/card` inside `src/components/clients/` with these. Delete `CardShell`, `HexMarker`, `GroupHeader`, `Row` and anything else left unused. Keep `fmtDate` only if something still needs it (prefer the shared `formatDate`).

### 2. Button rules (apply to every button in the client profile and the Clients list)

- **One primary action per card,** top right: filled primary button (today's ink/navy `Button` default), labeled verb + thing ("Add contact", "Upload PCSP", "Log a health event").
- **Secondary actions:** outline buttons next to it, same height.
- **Edit an existing card or row:** a 40 px square outline icon button with a pencil and an `aria-label` ("Edit identity"). Same position on every card.
- **Rare or risky actions** (archive, discharge, delete-like): in the ⋯ menu, never as a big button.
- **Links that leave the profile** say where they go ("Open in Evidence").
- Height 40 px on desktop, 44 px touch targets on phones. No buttons that only say "View", "Open editor", "Manage", "Submit", "OK".

Go through **every** `Button` in `src/components/clients/profile/` and `src/components/clients/list/` (about 160) and apply these rules. List each change, old label → new label, in the PR's button list.

### 3. Profile header (`profile-header.tsx`): the soft panel

- A panel with the muted surface background (`--hive-muted-surface`), 1 px border, a **4 px top stripe in ink** (`--hive-ink`), large rounded corners, padding 24 px. It sits inside the page width; it doesn't run edge to edge.
- **Top row, left:** 76 px avatar (photo, or initials on ink) with a 4 px white ring and a light shadow; the client's name (26 px, bold, ink); under it "Goes by <preferred name> · <age> · <home>"; a row of pills: each active code as a white outlined pill, then the readiness pill ("Ready to schedule" in ok tones, or "<N> to fix" in danger tones with the reasons in a tooltip).
- **Top row, right:** primary "Upload PCSP", outline "Add note", then the existing ⋯ menu (`header-menu.tsx`) with the rare actions (discharge, face sheet, archive). On phones the buttons wrap under the name.
- **Bottom row:** three `InfoTile`s in a grid (stacks on phones), each a link to its section:
  - **Guardian:** the guardian's name and relationship, or "Own guardian" (→ Contacts)
  - **Support coordinator:** name (→ Contacts)
  - **Plan year ends:** the date; when the PCSP is overdue, the tile turns amber and says "PCSP is N days overdue" (→ Plans)
- Delete whatever the old header used that's no longer needed (old chip constants, plan-year text helper if replaced).

### 4. Side menu (`ClientProfileShell` / `src/components/profile-shell/profile-shell.tsx`)

- White card, rounded, items at least 44 px tall, each with its existing icon in a small tile tinted by the section's tone (Profile gold, Contacts info, Health danger, Plans ok, Services gold, Client file info, Team ok, Activity neutral, Money neutral, Overview neutral).
- Active item: gold-soft background (`--hive-gold-soft`) and bold text. Counts (items needing attention) stay as a small pill on the right.
- On phones it becomes the existing horizontal scroll row of pills, same tones.
- The shell is shared with Team Members: make the change once in the shared shell so both profiles match, and check the Team Members profile still renders.

### 5. Page layout inside every section

- A section is a vertical stack with 20 px gaps. Use a **lead card** full width when one card is clearly the main one, then pairs of related cards in a 2-column grid (`grid gap-5 md:grid-cols-2`) where both cards are similar in height, then any long list full width.
- **Never** lay out two independent columns that grow to different heights (that's what leaves the big empty gap under Identity today).
- Empty cards use `EmptyState`: one sentence and the button that fills them ("No contacts yet. Add contact").

**Done when:** every card in the client profile uses `SectionCard`; `CardShell` and direct `ui/card` imports are gone from `src/components/clients/` (grep); the header matches the description above; the Team Members profile still loads; the profile e2e smoke test opens every section; build/tsc/unit pass vs. baseline; run the roster and staff go-live e2e suites.

---

## C2 — The Clients list page

**Goal:** the main Clients page matches the profile's new look and helps people fix things in one click.

### 1. Layout

- **Page header card** (`SectionCard`, neutral tone): title "Clients", description "Everyone your agency serves. Click a name to open their profile.", the active-client count, and the primary "Add client" button.
- **Toolbar** in its own white card: search, code, home and team filters, the view tabs (`list-view-tabs.tsx`), and "Export CSV" as an outline button.
- **Table** (`client-list-table.tsx`): avatar + name (with "Goes by …" under it), codes, home, units left, next due, team, readiness. Row hover highlight; the whole row opens the profile. Wide tables scroll inside their own box.
- **Phone cards** (`client-list-cards.tsx`): one card per client like the profile's contact cards: avatar, name, code pills, home, next due, readiness pill, and an "Open profile" button.

### 2. Remove the "Needs attention" filter

Jeff doesn't want it. Remove it completely:

1. Delete the toggle in `list-toolbar.tsx` and its state in `clients-page.tsx` and `use-client-list.ts`.
2. Remove `needsAttention` from the list filters, the server function input (`list.functions.ts`), the row type and the row loaders (`list.ts`, `list-load.ts`, `list-queries.ts`); delete `rowNeedsAttention` and its tests in `list.test.ts`.
3. Update `e2e/helpers/clients-list-mock.ts` and any e2e test that clicks the toggle.
4. **Keep** `LOW_UNITS_PCT` and `DUE_SOON_DAYS`: `list-cells.tsx` still uses them to color the units-left and next-due cells. Don't touch the Team Members constants or Smart Import's own `needsAttention`.

Afterwards, grep `needsAttention` and `rowNeedsAttention` under `src/` and `e2e/`: only Smart Import's remains.

### 3. Readiness tag

Rename "Ready" to **"Ready to schedule"** (it only means the client can be scheduled, not that nothing's due). "<N> to fix" keeps its tooltip.

### 4. Shortcuts on empty cells

When a cell is empty, make it a small link that opens the client's profile at the section that fixes it (`/dashboard/clients/$clientId?section=`). Both the table and the phone cards use `list-cells.tsx`.

| Cell | Today | Shortcut | Opens |
| --- | --- | --- | --- |
| Codes | "No codes" | "+ Add codes" | `services` |
| Home | blank | "+ Set home" | `profile` |
| Units left | "—" | "+ Add units" | `services` |
| Team | "None" | "+ Assign team" | `team` |

- The link must not also trigger the row's click (stop propagation).
- Show a shortcut only if the viewer can open and edit that section (`visibleClientSections` plus the section's edit check); otherwise keep plain text.
- Units left gets a shortcut only when the client has an active code with no yearly units; with no codes at all, show "—".
- Keep `list-cells.tsx` ≤ 250 lines; split `list-shortcut.tsx` if needed.

### 5. Ended codes and expired plans: show them, don't hide them

Today a client whose authorizations all ended (example: a client whose plan year and four codes ended Aug 31) shows "No codes" as if there never were any. The rows still exist; the list only shows active codes.

1. **Codes cell:** no active codes but some ended → show the ended codes dimmed with an amber link "Ended Aug 31 · Renew". If the plan year has also ended (no current plan, or its end date is past), the link says "Plan expired · Renew" and opens `plans`; otherwise `services`.
2. **Readiness:** "No authorized service code" becomes "Authorizations ended <date>" when the codes ended rather than never existed.
3. **Next due** uses the same wording as the Plans section (C4): "PCSP is N days overdue" / "PCSP expires in N days".
4. **No rule changes:** ended codes still can't be scheduled or billed after their end date. Display only. Never end-date or delete anything because a plan expired.

**Done when:** the list page and phone cards match the new look; the filter is gone (grep); shortcuts open the right section and respect permissions; unit tests cover the codes cell (active, ended, plan expired, never had codes) and readiness wording; build/tsc/unit pass vs. baseline; run the roster e2e suite.
