# Clients polish — C5 and C6

Read `00-START-HERE.md` first. Use C1's `SectionCard`, `InfoTile`, `FieldGrid`, `StatusTag`, `EmptyState` and button rules everywhere below.

## C5 — Client file: one source of truth with Evidence

The Clients rebuild built the Client file as a second, hard-coded list (`REQUIRED_DOCS` in `src/lib/clients/file-required.ts`). Evidence already has a client catalog (`src/lib/evidence/catalog.ts`, subject `client`), each row with a plain-language `why`, client packs keyed by code (`EVIDENCE_PACKS`), and a `waived` status. Two lists will drift. Make Evidence the only source. The section keeps the name **"Client file"**.

1. **The Client file reads Evidence.** Replace `REQUIRED_DOCS` with the client's Evidence rows. Uploads go through the existing Evidence path (`recordEvidenceUpload`), so an upload in the Client file and one in Evidence are the same record. Delete `REQUIRED_DOCS`, `required-documents-card.tsx` and anything only they used. Move rows only the Client file had (medical exam, dental exam, guardian / legal papers, with their yearly renewal) into the Evidence client catalog, each with a `why`.
2. **Every row explains itself:** title, then its `why` in one or two plain sentences, then status and the button. Example, grievance receipt: "At admission, the person or guardian must get your grievance process in writing and sign that they received it (SOW §1.10(11)). This shows they know how to raise a concern." No row is just a name and an Upload button.
3. **"Not needed for this client"** on every row, with reason chips ("Person declined", "Doesn't apply to this client", "Kept outside PI", Other). Saves as `waived` with the reason; shows grey "Not needed: <reason>" instead of red "Missing"; doesn't count in Needs attention; can be undone. Example: a person who doesn't want their photo in the platform.
4. **Packs follow the client's codes automatically.** Today packs only apply when an admin runs the Evidence questionnaire for selected clients.
   - When a client gains an active code, add that code's client pack rows (once the agency has applied that pack at all).
   - When a code ends and no other active code needs a row, mark the row "Not needed: <code> ended <date>" (keep it and its files; never delete).
   - A client with no HHS, PPS or RHS never gets housemate discussion, room and board, or lease rows.
   - Catalog gaps: `housemate_discussion` is only in the HHS pack, but its own `why` says HHS, PPS or RHS. Add it to the RHS pack and add a PPS residence pack. Check the room and board rows the same way against the SOW.
5. **Choosing packs when none are set up:** if the agency skipped the Evidence pack review at onboarding, the section shows `EmptyState`: "Choose which documents your agency keeps for each client." with a button that opens the Evidence pack review for clients (reuse it). Nothing shows as Missing until a pack is applied. Keep the Evidence disclaimer ("suggestions only … verify against your SOW").
6. **Edit what's required from the profile:** a lead card "What's required for <first name>" (owners and admins with Evidence edit access) listing the packs on this client, each marked "From <code>" or "Added by hand", with: **Add a pack** (with each pack's description), **Remove a pack** (its rows become "Not needed: pack removed"), **Add one item** (from the catalog, or custom with a name and a short explanation), and **"Open in Evidence"** for agency-wide changes. Everyone else sees it read-only. Save through `applyEvidenceRequirements`, `removeEvidenceRequirement`, `restoreEvidenceRequirement`.
7. **1056 is optional:** it lives in DSPD's UPI system and Jeff decided it isn't a required upload. Show "Upload a copy of the 1056 (optional)". The 1056 number and approved date on each code (Services & billing) stay.
8. **Layout:** the "What's required" lead card, then the documents grouped by pack, each pack a `SectionCard` (tone info) with its rows as a list: title + why on the left, `StatusTag` (On file · expires <date> / Missing / Not needed) and the row's button on the right. Host home certification stays linked to the host's record.

**Done when:** `REQUIRED_DOCS` and the old card are gone (grep); every row shows its `why`; waived rows show "Not needed" and don't count in Needs attention; adding and ending a code adds and retires the right rows (unit tests); the pack editor works for admins and is read-only for others; build/tsc/unit pass vs. baseline.

---

## C6 — Contacts, Health, Services & billing, Money, Team, Activity & notes

**Goal:** every remaining section gets the same organized, friendly layout. Same rules in each: a header `SectionCard` with the section's one-line purpose and its primary button, then content cards; no empty columns; empty states say what to do.

### Contacts (`profile/contacts/`)

- Header card: "Contacts", "Who to call, and for what. Guardian first.", primary **Add contact**.
- **One grid of contact cards, no sub-category headings** (drop the Guardian / Representative / Emergency / Support coordinator / Doctors and providers groups). Order: guardian first, then support coordinator, then everyone else by name.
- Each card: initials avatar tinted by role tone, name, organization or relationship, one role `StatusTag` (Guardian, Support coordinator, Doctor, Work, Other provider, Emergency…), a short note, and three buttons: **Call** and **Email** (real `tel:` / `mailto:` links, shown only when the number or email exists) and the pencil **Edit** icon. Ended contacts move to a "Past contacts" link at the bottom (archived, never deleted).
- Delete `contact-row.tsx` and the grouping code once the cards replace them.

### Health (`profile/health/`, `sections/health-section.tsx`)

- Header card: "Health", "What staff need to keep <first name> safe.", primary **Log a health event**.
- A row of four `InfoTile`s: **Allergies**, **Diet** (incl. swallowing), **Mobility**, **Emergency plan** (advance directive / DNR / seizure plan), each with one line of detail and a link to its card.
- Then cards in pairs: Medications | Recent health events (timeline with colored dots by type), Care needs | Absences. Medications card links to the eMAR.
- Merge cards that show the same thing twice; delete the ones replaced.

### Services & billing (`profile/services/`)

- Header card: "Services & billing", "What the state authorized, and how much is used.", primary **Add authorization**.
- One card per active code: code and name, dates, 1056 number, a units bar (used / left / pace), rate, and the pencil. Ended codes in a "Past authorizations" list below with a **Renew** button (renewing must not overwrite the old authorization's dates or 1056 number; check this).
- Monthly budget card full width under them.

### Money (`profile/money/`), only for clients with PBA, loans or spending

- Header card: "Money", "Personal funds the agency helps manage.", primary **Add transaction**.
- `InfoTile`s for balance, this month's spending and open loans; then the ledger card, then loans.

### Team (`profile/team/`)

- Header card: "Team", "Team members who work with <first name>, and on which codes.", primary **Assign team member**.
- Team member cards like Contacts: avatar, name, codes they work on, a readiness `StatusTag` (Ready alone / Training needed), pencil to change codes. The do-not-schedule list in its own card below, with the reason on each entry.

### Activity & notes (`profile/activity/`)

- Header card: "Activity & notes", "Shifts, daily logs, incidents and office notes, newest first.", primary **Add note**.
- One timeline with filter pills (All, Shift notes, Daily logs, Incidents, Office notes) instead of separate panels; each entry shows type, date, author, code and a preview, opening the full record in a side panel. Office-only notes keep their lock icon and visibility rules.
- Delete the separate panels once the timeline covers them.

**Done when:** every section above uses the C1 pieces and has no empty columns or unlabeled buttons; contacts show as one grid with Call/Email/Edit; the PR's button list covers every button in these sections; build/tsc/unit pass vs. baseline.
