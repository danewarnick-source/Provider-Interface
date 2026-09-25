# The Employees Tab, Explained Simply

**What this is:** a plain-English walkthrough of every button on the Employees tab in HIVE — what it does when you click it, where the data goes, and what's broken. Written for someone who builds with AI tools and doesn't want to read code.

**Date checked:** 2026-09-21. Everything here was verified by reading the actual code and clicking through the app in a test browser. If the code and this doc ever disagree, the code wins — tell us and we'll fix the doc.

The long, technical version of this same document is `docs/employees-tab-functional-spec.md`. This one is the friendly version.

---

## Before you start: five words you'll see a lot

| Word | What it means here |
|---|---|
| **Owner / Program Manager / Supervisor / Staff** | The four job levels in HIVE. Owner can do everything. Staff can do almost nothing on this tab. (Under the hood these are called `admin`, `program_manager`, `manager`, `employee` — you'll see those raw words in some places, which is one of the bugs.) |
| **Server function** | A trusted helper that runs on HIVE's server, not in your browser. It double-checks who you are before it touches the database. Most important buttons use one. |
| **Direct write** | The browser talks to the database itself, with no helper in between. Faster to build, but if the database says "no" the browser sometimes doesn't notice. Three buttons on this tab do this, and two of them are bugs. |
| **RLS (the database bouncer)** | Rules inside the database that decide which rows each person can see or change. Even if the app has a bug, the bouncer stops you touching another agency's data. |
| **Obligation / Staff file** | A compliance item a staffer must have on file (background check, Medicaid disclosure, etc.). "Staff file" is the list of those items for one person. |

## The four colors (the tester's buckets)

| Tag | Plain meaning |
|---|---|
| **EXACTLY WHAT WE WANT** | Works. We clicked it or a test covers it. Ship it. |
| **UNTESTED** | Looks right in the code, but nobody has clicked it against the real database yet. Usually because it sends email, makes a PDF, or changes a password. Needs a human pass. |
| **NEEDS ATTENTION** | Something is wrong. Each one has a numbered bug (F-1, F-2 …) in the "Bugs" section with a plain fix. |
| **YET TO BREAK DOWN** | The button jumps to a different tab (Clients, State Audit, Evidence…). We documented up to the door and stopped. |

---

## The 30-second version

The Employees tab is one page with four sub-tabs across the top:

```
[ Roster ]  [ Hosts ]  [ HR Admin ]  [ Employee Loans ]
```

- **Roster** — the list of your people. Hire, deactivate, reset passwords, assign clients. Click a name to open their full page.
- **Hosts** — a board for Host Home Providers (families who host clients). They are **not** employees and never clock in.
- **HR Admin** — a launcher. It mostly just sends you to the Staff File page and HR Settings.
- **Employee Loans** — record and e-sign loan/advance agreements between the agency and a staffer.

### The one gate that blocks everything

If the agency hasn't answered its six setup questions (do you run an OL site, use volunteers, have a board, which services, how many clients, what area), the **whole tab is replaced** by a card saying *"Finish agency setup first."* The server enforces the same rule, so you can't sneak around it with an old browser tab. Once setup is done, the tabs appear. (TNS is done, so you'll never see this unless you make a new agency.)

### Who can see what

| Can they… | Owner | Program Manager | Supervisor | Staff |
|---|---|---|---|---|
| See the Roster / HR Admin / Loans tabs | yes | yes | yes | no |
| Add employees / upload a roster | yes | yes | yes | no |
| Edit someone's name, phone, hire date | yes | yes | no | no |
| Change someone's role | yes | no | no | no |
| Deactivate / delete someone | yes | no (button hidden) | no (button hidden) | no |
| Save the Roster → Settings toggles | yes | **looks like yes, actually no** (bug F-1) | **same** | no |
| Edit a Host card | yes | no | no | no |
| Use Employee Loans | yes | yes (double-check live with Q7) | yes | no |

---

## Part 1 — The Roster

### What you see

```
Employees                                    [Roster] [Hosts] [HR Admin] [Employee Loans]
─────────────────────────────────────────────────────────────────────────────────────────
Team members                        [Upload roster]  [+ Add employee]  [Settings]
5 active · 1 pending invite

Pending invitations  (only shows if someone hasn't accepted yet)
  new.dsp@example.com · employee            [Resend] [Copy link] [Uninvite]

[Active 5]  [Inactive 0]

NAME          LOGIN          ROLE       STATUS   START DATE   LAST LOGIN   ACTIONS
Jake Probert  jake.probert   EMPLOYEE   Active   Jan 15 2025  Aug 27 2026  [Caseload] ⋯
  DSP
```

### Where the list comes from

HIVE asks the database two questions: "who is a member of this agency?" and "what are their profile details?", then glues the answers together in the browser. (It has to do it in two steps — there's no direct link between those two tables.) "Last login" comes from a third small lookup.

**Who counts as Active?** Someone is Active only if all three are true: they're marked active as a member, their profile isn't archived, and their profile isn't flagged inactive. Anything else → Inactive tab. The "5 active" number in the header uses the exact same rule, so the header and the pill will always match. This has a unit test.

### Button by button

#### Upload roster (2.1.1.1)

**What it's for:** hire a bunch of people at once from a spreadsheet.

**What happens:**

1. Pick a mode:
   - **Add new only** — skip anyone whose email is already on the roster.
   - **Add new and update existing** — match on email; new emails get created, existing ones get updated.
   - **Update existing only** — new emails are ignored.
2. **Download template** gives you `employee-roster-template.xlsx` with the right column headers. Made in your browser, nothing hits the server.
3. Drop a CSV or Excel file. HIVE reads it, cleans up header names, and shows you a review grid. Each row gets a badge: *create*, *update*, or *skip*. Red cells = problems (bad email, missing name). The Apply button is disabled until the red is gone.
4. **Apply** runs the same "hire one person" helper (below) for every row, one at a time.
5. Then you get the same "Send invites?" screen as Add employee.

**Status:** EXACTLY WHAT WE WANT for reading and classifying the file (unit-tested). UNTESTED for the live Apply and the drag-and-drop itself.

#### Add employee (2.1.1.2)

**What it's for:** hire one or a few people by typing them in.

**The form:** First name, Last name, Email, Phone, Hire date (all five required), Role (Employee / Manager / Admin), and — only if you turned them on in Settings — Staff type, Department, Employee ID, Worker type, and any custom fields.

**+ Add another employee** adds another card. No limit. Each card has a trash icon.

**Create employee** (label becomes "Create 3 employees" if you have three) calls a server function that, for each person:

1. Creates a login with a random temporary password.
2. Creates their profile with everything you typed, flagged "must change password on first sign-in."
3. Adds them to the agency with the role you picked.
4. Writes an audit-log line.
5. Kicks off the compliance engine, so their Staff File already has rows like "Background Screening — Missing" the moment you look.

If an email already exists, that person fails with an error toast; the others still get created.

**Step 2 — "Send invites?"** Nobody is pre-checked. For each person you can:
- tick the box and hit **Send 1 invite** → emails them a join link, or
- **Show temporary password** → shows it once with a Copy button so you can hand it over yourself, or
- **Don't invite yet** → closes, sends nothing.

**X in the corner** throws the drafts away. Nothing was saved, nothing to clean up.

**Status:** EXACTLY WHAT WE WANT (an automated browser test walks step 1 → step 2 → send invite). One bug: the Role dropdown says *Employee / Manager / Admin* while everywhere else in HIVE the same roles are called *Staff / Supervisor / Owner*, and you can't pick Program Manager at hire time (F-6).

#### Settings (2.1.1.3) — "Staff fields"

**What it's for:** choose which fields show up on the Add employee form and the profile.

**What you see:**
- **Cannot be turned off:** First name, Last name, Email, Phone, Hire date, Role.
- **Standard fields** with on/off switches: Staff type (on by default, with chips like DSP / Host Home Provider / Executive Director / Operations Director / Executive Assistant — you can add or × remove options), Department (off by default, same chip idea), Employee ID, Worker type (W2 / 1099 / Other — fixed list).
- **Custom fields:** + Add field → name it, pick Text / Date / Yes-No / Number / Dropdown → Save or Cancel.

Every flip waits half a second and then saves the whole config to the agency's settings record. "Saved" flashes for two seconds.

**Status: NEEDS ATTENTION — this is the "doesn't save toggles" bug, and we found exactly why.** The panel writes straight to the database from the browser (a direct write). The database bouncer only lets **Owners** change the agency record. For a Program Manager or Supervisor the bouncer quietly filters out the row, the database replies "OK, 0 rows changed", the browser only checks for an *error* (there isn't one), and shows "Saved" anyway. So: Owners → it saves. Everyone else → it lies. Bug F-1.

#### Active / Inactive pills (2.1.2)

Pure browser-side filter. No network call. Empty Inactive tab says "No deactivated employees". **EXACTLY WHAT WE WANT.**

#### The list columns (2.1.3)

| Column | What it shows |
|---|---|
| NAME | Full name, with job title underneath |
| LOGIN | Their username if they have one, otherwise email |
| ROLE | The raw role word as a badge (EMPLOYEE, MANAGER, ADMIN, PROGRAM_MANAGER) — part of bug F-6 |
| STATUS | Active or Deactivated |
| START DATE | Hire date (falls back to the older "start date" field) |
| LAST LOGIN | "Never" or a date |
| ACTIONS | Caseload button and the ⋯ menu |

Click anywhere on a row (except the Actions column) → opens that person's page. **EXACTLY WHAT WE WANT** (tested).

#### Caseload (2.1.3.7.1)

**What it's for:** say which clients this staffer works with.

A side panel slides in. Search by client name (also matches their service code). Every client in the agency has a checkbox, showing name + codes. **Save Caseload Modifications** compares what you ticked against what was there, deletes the removed ones, inserts the added ones, then pings the compliance engine so client-specific requirements update.

**Status: UNTESTED and NEEDS ATTENTION (F-4).** It's a direct write from the browser. It tells the compliance engine "service codes: none", so code-specific requirements won't fire. And if the compliance ping fails, the error is only written to the browser console — you'll never see it.

#### The ⋯ menu (2.1.3.7.2)

| Item | What actually happens |
|---|---|
| **Reset password** | Server sets a new random temporary password on their login and flags "must change on next sign-in". A dialog shows the password once with Copy. |
| **Deactivate** (on Active tab) | Server archives the profile, marks them inactive, removes them from their team, and **logs them out everywhere**. They move to the Inactive tab. |
| **Reactivate** (on Inactive tab — not in the tree, but it's there) | Reverse of Deactivate. |
| **Delete** | You must type their exact name. Server removes them from **this agency**. If this was their only agency, it also deletes their training records, external certs, PBA data, profile, and the login itself. Cannot be undone. |

**Status:** all UNTESTED live (they touch the login system), but the code path is straightforward.

#### Pending invitations card (not in the tree)

Appears only when someone has an unanswered join link. **Resend** re-sends the same link. **Copy link** copies it. **Uninvite** asks "are you sure?" and kills the link.

---

## Part 2 — One employee's page (click a name)

### What you see

```
[← Employees]   (JP) Jake Probert                                 [Back to list]
                [EMPLOYEE] [ACTIVE] [Face Sheet ▾] · Hired 2025-01-15
─────────────────────────────────────────────────────────────────────────────
[Profile]  [Staff file]  [Activity]
```

### The two back buttons (2.1.4.1, 2.1.4.2)

Both do the same thing: go back one step in browser history. Problem: switching between Profile / Staff file / Activity also counts as a step. So if you look at two tabs and press Back, you land on the previous *tab*, not the list. **NEEDS ATTENTION (F-7).** Fix: make Back always go to the roster.

### Face Sheet (2.1.4.3)

A dropdown. Each choice asks the server to build a one-page PDF of this person's profile.

| Choice | Result |
|---|---|
| Preview | Opens the PDF in a new browser tab |
| Download PDF | Saves `employee-face-sheet-<name>.pdf` |
| Print | Opens it and pops the print dialog |
| Ship to HR Docs | Saves the PDF into their documents folder in HIVE |

**Status: UNTESTED** live (server PDF + file storage).

### Profile tab (2.1.4.4)

Three collapsible sections and one **Edit profile** button that unlocks all three at once.

**Profile (2.1.4.4.1)** — photo, first/last name, email, username, phone, base role, hire date, employee ID, job title, plus any staff fields you enabled. Locked to the person in the URL (there was once a "wrong person" bug; a test now guards it). Editing identity needs the *Edit staff records* permission; the Role dropdown only unlocks with *Manage staff roles* (Owner only). Role choices here: Staff, Supervisor, Program Manager, Owner, Committee Member.

**Leads group / Scope (2.1.4.4.2)** — which group of clients/staff this person is allowed to see. In our test setup this section said *"Scope columns are not live yet"* because the feature depends on a database table that may not exist on the live tenant yet. **UNTESTED** — the database check Q4 at the end tells you if it's live.

**Permissions (2.1.4.4.3)** — 83 switches in three groups: **People & Files (52)**, **Schedule & Money (20)**, **Staff Phone Permissions (11)**. Each row shows: the switch, what the role gets by default, and an "override" tag if this person differs from their role. When you save, HIVE only stores the *differences* from the role default (so flipping something back to default deletes the override instead of storing a pointless one — unit-tested). It also writes an audit line and drops a notification for the staffer. Needs *Manage permissions* (Owner only). The full list of 83 with who-gets-what is at the end of this doc.

**Edit profile → Save profile / Cancel (2.1.4.4.4)** — Save runs four writes in a row: identity, then role, then permission switches, then scope. If write #3 fails, #1 and #2 already happened. Not dangerous, but the error toast will confuse you. **UNTESTED**, minor note F-9.

### Staff file tab (2.1.4.5)

One row per compliance item this person owes. Loaded through a server function.

**What the statuses mean (this answers the "Status (Missing??)" question):**

| Status | Rule |
|---|---|
| **On file** | Valid evidence has been uploaded |
| **Due soon** | No evidence yet, and the due date is within the next 7 days |
| **Missing** | Everything else — including "due in 214 days, nothing uploaded yet" and "overdue by 30 days" (the Due column then says *Missing — 30 days ago*) |

So a brand-new hire shows **Missing** on every annual item. That's on purpose: nothing is on file yet. It is not a bug.

| Button | What it does |
|---|---|
| **View selected** | Opens a viewer for the ticked rows that have a file. Disabled if nothing ticked. |
| **Print / PDF pack** | Opens a print window with the ticked rows' files. Pop-up blockers will stop it (you get an error toast). |
| **Upload evidence…** | Pick which item, choose a file, optional note → file is stored, row flips to On file. |
| **View** (eye icon per row) | Only enabled when the row has a file — matches what the tree says. |
| **Override** (per row) | Record a waiver with a reason; shows up under "Override history". |

**Status:** the status logic is EXACTLY WHAT WE WANT (unit-tested). The three buttons are UNTESTED live (file storage).

### Activity tab (2.1.4.6)

Read-only, newest first. Filter chips: **All · Shifts · Timesheets · Forms · Incidents.**

| Chip | Where it pulls from | What a row shows |
|---|---|---|
| Shifts | This person's EVV clock-in records (up to 200) | Date · Client (link) · Code · Status · Units |
| Timesheets | The **same** EVV records, only the ones with a status | "CODE · N units", status, date |
| Forms | Forms they submitted (up to 100) | Form name · status · date |
| Incidents | Incident reports they filed (up to 100) | Report number · incident types (Injury, Illness, …) · status like *pending admin review* · date |

**Bug F-8:** because Shifts and Timesheets read the same records, every clocked shift with a status shows up **twice** in the All view. The "IR ID badge → Injury / Illness / ??" question: those labels come from the Incident Report form, which is a different tab → **YET TO BREAK DOWN.**

---

## Part 3 — Hosts

### What it is

A three-column board of **Host Home Provider cue cards** — a quick profile of a family that could host a client. Hosts are **not employees**. They never clock in, never show in the scheduler. A card *can* be linked to a staff login if the same person also works as a DSP; then the card gets an "Also DSP" chip.

```
Host Home Providers                                            [+ New host]
┌ Onboarding (2) ┐  ┌ Ready (1) ┐  ┌ Placed (3) ┐
│ Jane Host       │  │ …          │  │ Sam Host    │
│ [No cert]       │  │            │  │ [Cert ✓]    │
│ [Also DSP]      │  │            │  │             │
│ Onboarding      │  │            │  │ Placed      │
└─────────────────┘  └────────────┘  └─────────────┘
```

Every card shows: Name, an HHS certification badge (*No cert* / *Cert overdue* / *Cert due in N days* if within 30 / *Cert ✓*), the *Also DSP* chip if linked, and the status word. The tree lists these only under "Placed" but they appear in all three columns.

### New host (2.2.1)

A form with exactly the fields in the tree: Name (required), Phone, Email, Address, City, County, Pets, three checkboxes (Wheelchair accessible, Sign language, Criminal history flag), Experience summary, Behavioral comfort, Communication abilities, Medical comfort (comma-separated → becomes a list), Independence levels (same), Schedule availability, Commitment length. **Create host** saves it via a server function with status = Onboarding. X closes without saving.

### Clicking a card

Opens a detail dialog: everything you typed (read-only), plus an editable **Status** dropdown (move between columns), **Provider notes**, **Link to staff** (pick from active members, or "Invite as staff"), and a certification panel (inspection history, add a cert).

**Bug F-5:** the Hosts tab is visible to anyone who can view staff records (Owner, PM, Supervisor), but editing a card needs *Manage referrals* (Owner only by default). PMs and Supervisors open a card and everything is greyed out with **no explanation**. Fix: one line of text saying "Only Owners can edit host cards", or hide the tab for them.

The page also says "submitting a Host Home Questionnaire auto-creates a card" — that comes from another part of HIVE → **YET TO BREAK DOWN.**

**Status:** form and board are EXACTLY WHAT WE WANT (fields match the tree 1:1, renders clean). Live save UNTESTED.

---

## Part 4 — HR Admin

### What the tab itself is

Honestly, not much. It's a launcher:

```
HR Admin                                  [Open Staff file]  [HR Settings]
Other trainings and HR settings. File status for every staffer lives on Staff file.

┌ Other Trainings & Tasks (rollup)      [0 NECTAR proposals] [0 open] [0 done] ┐
│ No assignments yet.                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

The underlined "Staff file" in the sentence and the **Open Staff file** button go to the same place (the tree already noticed this). The tester's "move this tab entirely?" is a product call — functionally it's two links and one card.

**The rollup (2.3.3–2.3.5)** reads the "other assignments" table (trainings/tasks that aren't formal courses). Badges: *N NECTAR proposals* (suggested by the AI, not yet confirmed), *N open* (confirmed, not done), *N done*. Empty state: "No assignments yet." Read-only here; assignments are created in Training. **EXACTLY WHAT WE WANT.**

### HR Settings (2.3.2) — the "EMPTY PAGE"

It isn't actually empty. It has one card, **Staff types & applicability**, and until someone clicks **Run NECTAR proposal** the card body is a dashed box saying *"No proposal yet…"* — that's what looked empty. After you run it: a list of staff types you can add/remove, a grid of "which requirement applies to which type", and **Confirm all**. Until you confirm, nothing shows as N/A anywhere.

There **is** a back button ("← HR Admin"), but it goes to the old standalone HR Admin page, not back to the Employees tab. **F-2.** Also confusing: the Roster's **Settings** (which fields to collect) and this **HR Settings** (staff types) are two unrelated things that both sound like "HR settings". **F-3.**

### Staff file page (2.3.1.1) — `/dashboard/compliance`, Staff tab

This is where compliance actually lives. Three tabs at the top: **Staff file · Client file · Agency file**. Client and Agency lead to other parts of HIVE → **YET TO BREAK DOWN.**

On the Staff file tab:

- Top right: **State Audit** (→ another area, `4.4.???`) and **Reports** links.
- An amber card *"N certificates awaiting review"* when staff have uploaded certs nobody has approved yet — each one links to a review screen.
- A "next action" card from the compliance packet.
- **The table** — one row per staffer:

```
🔍 Search staff, role, or codes…   [Practice audit] [Export missing CSV] [Export pack for selected]

☐ │ STAFF          │ ROLE / CODES            │ MISSING │ DUE SOON │ ON FILE
☐ │ Jake Probert   │ [EMPLOYEE] DSP HHS SLN  │   3     │    0     │    0
```

| Button | What it does |
|---|---|
| **Search** | Filters by name, role, job title, or service code (type "HHS" to see everyone on HHS). |
| **Practice audit** | Jumps to the Internal Audit page pre-filtered to Staff Certifications and, if you ticked rows, to those people. **No back button there (F-2).** |
| **Export missing CSV** | Downloads `personnel-file-missing-<date>.csv` with only the rows that have Missing > 0. **It's a CSV, not a PDF — the tree says PDF; the tree is wrong.** If nothing is missing you get a toast saying so. |
| **Export pack for selected** | You must tick rows first. Opens a print window with every evidence file for those people; use the browser's Save as PDF. |
| **Click a row** | Opens that person's page on the **Staff file** tab. |

The Missing / Due soon / On file counts use the same rules as the person's own Staff file tab, so the numbers should always match (check Q10 at the end).

### Reports (2.3.1.1.2) — `/dashboard/reports`

Two tabs. **Standard Reports:** five cards each with **Download CSV** — Compliance Summary, Training Completion, Module Completions, Overdue Training, Certification Renewals. **Behavior Supports:** filters (Client, Behaviorist, BC code, From, To) → Export CSV / Export PDF → a results list. **No back button (F-2).** Renders fine in our test; live downloads UNTESTED.

### Practice audit / Internal Audit (2.3.1.1.4) — `/dashboard/internal-audit`

Everything in the tree is there: Run audit now, Export, DSPD-style sample (pick clients / pick staff, with "DSPD requested" toggles), scope filters (Client, Area, Service code, From, To), the four summary numbers (Audit readiness / Critical gaps / Needs attention / Minor), Findings by area (Documentation, Staff Certifications, Daily Logs, Requirements Engine, EVV/Timesheets, External Attestations, Billing & Authorizations), and a Findings list whose "Open staff file" links jump back to that person's Staff file tab. We couldn't run it in the test harness (its server call isn't mocked) → **UNTESTED**, plus F-2 no back button.

---

## Part 5 — Employee Loans

### What it is

Admin-only recordkeeping for money the agency advances to a staffer, with a built-in e-signature flow. Four database tables: the agreement, its ledger lines, the signature record (name, drawn signature, IP, time), and one-time signing links.

```
Employee Loan Ledger
┌ Start a new loan agreement ─────────────────────────────────────────────┐
│ [🔍 Search employees…]  [Select employee… ▾]  [+ New loan]  (disabled until you pick) │
└─────────────────────────────────────────────────────────────────────────┘
┌ Agreements on file ─────────────────────────────────────────────────────┐
│ EMPLOYEE   │ BORROWER (ON AGREEMENT) │ DATE       │ STATUS  │  [Open]   │
│ Jake P.    │ Jake Probert            │ 2026-09-01 │ [draft] │  [Open]   │
└─────────────────────────────────────────────────────────────────────────┘
```

**F-10 (withdrawn):** An earlier version of this doc said Program Managers were blocked from loans. That was wrong. The database rule for all four loan tables (`is_org_admin_or_manager`) lets Owners, Program Managers and Supervisors in. That rule was updated in migration `20260825020000`. Run Q7 at the end to confirm the live database has the same rule. If `program_manager` is missing there, the migration never reached the live database.

### Starting a loan (2.4.2)

Search narrows the dropdown. Pick a person. **+ New loan** swaps the ledger for the editor (same screen, **Back** returns). *(The tree numbers this 2.1.2.3 — it should be 2.4.2.3.)*

### The editor (new or existing)

Top bar: **Back · Download PDF · Send for e-signature · Save · Delete** (some hide depending on status — see below).

Under the title it always says **"DRAFT — pending legal review"** — even on a signed loan. It's hard-coded text. **Bug F-11.** Next to it, real badges appear when relevant: *Locked (signed)*, *Signed by <name>*, *Awaiting signature (<email>)*.

**The form sections** (match the tree):

| Section | Fields | Defaults worth knowing |
|---|---|---|
| Parties & Date | Employee (borrower), **Employee email** (not in the tree — required before you can send for signature), Employer (lender), Agreement date, Purpose | Lender = your agency name; date = today |
| Advance terms | Amount ($), Cadence | Cadence order on screen: One-time, Weekly, Biweekly, Monthly; default One-time |
| Recurring direct payment (optional) | Amount, Cadence, Due day/detail, Start date, Description | Cadence default Monthly |
| Interest | Rate (% / year), Notes | 0 = interest-free |
| Repayment terms | + Add condition, condition list, Maturity date, Method of repayment | Two conditions are pre-filled (paycheck deduction with written consent; in full on termination). Method is free text. |
| Acknowledgments | One checkbox | Pre-checked: accepting or declining doesn't affect employment |
| Signature parties | + Add party; each has Role, Name, Title | Employee and Employer pre-filled. **Extra parties are text on the PDF only — they do NOT get their own signing link (F-12, see below).** |
| Electronic signature on file | read-only | Appears once signed: who, email, method, time, IP, signature image |
| Loan Ledger | Add entry: date, kind (Advance / Direct payment / Repayment / Adjustment), amount, note; running balance | Only on saved loans. **Stays editable after signing** — on purpose, repayments happen later. |
| Internal notes | textarea | |

**The buttons:**

| Button | When you see it | What happens |
|---|---|---|
| **Back** | always | Returns to the ledger. **Unsaved edits are lost silently.** |
| **Download PDF** | always | Builds a PDF in your browser from what's on screen right now + the ledger balance + the signature block if signed. Named `employee-loan-<borrower>.pdf`. On a signed loan, this is your signed copy. |
| **Send for e-signature** | saved loan, not yet signed | Greyed out until Employee email is filled (no hint why — minor). Opens a dialog: Signer name, Signer email, Cancel, **Send for signature**. The server makes a one-time link, tries to email it, and shows the link so you can copy it, then **Done**. While the link is out, an amber card shows *"Signing link sent to … expires …"* with a **Void link** button. |
| **Save** | not yet signed | New loan → creates it and returns to the ledger. Existing → updates in place. Toast "Loan saved". |
| **Delete** | saved loan | Browser "are you sure?" → deletes the agreement and its ledger, tokens, and signature. **Works on signed loans too** — flag for legal. |

### Open by status (2.4.3.5)

Same editor, different locks:

- **Draft** → everything editable; Save, Send for e-signature, Delete available.
- **Signed / Active** → the whole form is greyed out; Save and Send disappear; Back, Download PDF, Delete stay; the ledger still accepts entries.

Matches what the tree describes. **EXACTLY WHAT WE WANT** for the lock logic; all live actions **UNTESTED**.

**F-12 (the tester's request):** you can only send to one signer per send. The tester wants lawyers, SCE, payees etc. to sign too. That's a real product change: one signing link per party and an "everyone has signed" state. Documented, not built.

---

## Part 6 — The bugs, in plain English

| # | Where | What you'll see | Why | How to fix (paste-able for your AI) |
|---|---|---|---|---|
| **F-1** | Roster → Settings | Toggles flash "Saved" but don't stick unless you're an Owner | Browser writes straight to the agency record; the database bouncer silently drops it for non-Owners; the code only checks for errors, not for "0 rows changed" | "In `staff-fields-panel.tsx`, move the `organizations.update` into a server function that checks the caller is an org manager, and show an error toast if the update returns no rows. Disable the panel for roles that can't write." |
| **F-2** | HR Settings, Reports, Internal Audit, State Audit | No way back to the Employees tab; HR Settings' back goes to the old standalone page | These are separate top-level pages | "Change the HR Settings back link to `/dashboard/hub/employees?tab=hr-admin`, and add the same back button to Reports and Internal Audit." |
| **F-3** | Two "Settings" | Roster → Settings and HR Admin → HR Settings sound the same but aren't | Two features, two homes | "Rename the roster Settings button to 'Staff fields'." |
| **F-4** | Caseload panel | Saves work but compliance rules tied to service codes don't fire; errors are hidden | Browser writes directly and passes an empty code list; errors only go to the console | "Move the caseload save into a server function that inserts/deletes `staff_assignments` and calls the assignment hooks with the client's authorized codes from `client_billing_codes`. Show a toast on failure." |
| **F-5** | Host card dialog | PMs/Supervisors open a card, everything is greyed, no explanation | Tab visibility and edit permission use different rules | "In the host detail dialog, when `canManage` is false show a line: 'Only Owners can edit host cards.'" |
| **F-6** | Add employee → Role | Says Employee/Manager/Admin; rest of HIVE says Staff/Supervisor/Owner; no Program Manager option | Hard-coded dropdown | "In `add-employee-wizard.tsx`, build the Role dropdown from `ROLE_OPTIONS` and `ROLE_LABEL` in `src/lib/rbac.ts` instead of hard-coded items. Same for the roster ROLE badge." |
| **F-7** | Employee page → Back | Goes to the previous tab, not the list | Uses browser history; tab clicks add history | "Make both back buttons navigate to `/dashboard/hub/employees` directly." |
| **F-8** | Employee page → Activity → All | Every shift appears twice | Shifts and Timesheets read the same records | "In `ActivityFeed`, only create a Timesheet item when the EVV row is in a payroll status (approved/submitted), or merge Shift and Timesheet into one line." |
| **F-9** | Employee page → Save profile | If one of four saves fails, the earlier ones already went through | Four sequential writes, no rollback | Acceptable for now. Long-term: one server function does all four. |
| **F-10** (withdrawn) | Employee Loans | Not a bug: Program Managers are allowed by the current database rule | Earlier doc misread an older migration | Nothing, unless Q7 shows the live rule is missing `program_manager`. |
| **F-11** | Loan editor header | "DRAFT — pending legal review" on signed loans | Hard-coded text | "Replace the static subtitle with the loan's actual `status`." |
| **F-12** | Send for e-signature | One signer only; extra parties don't get links | Design: one token per send | Product decision. Multi-party = one link per party + "all signed" state. |
| **F-13** | Test harness (not the app) | The roster browser tests failed on `main` | Two new server functions weren't mocked; wizard wording changed | **Fixed in this PR.** |

Also noticed, not bugs: the "Set up Evidence pack" button on the invite step does a full page reload to the Evidence tab (YET TO BREAK DOWN). Deactivate / Delete / Uninvite use three different confirm styles (two browser pop-ups, one type-your-name dialog) — inconsistent but working.

---

## Part 7 — What we actually tested

No live database login is available to the agent, so browser tests ran against a **fake Supabase** that answers with realistic TNS data.

| What | How | Result |
|---|---|---|
| The logic: who's active, spreadsheet parsing, staff file statuses, permission groups (52+20+11=83), permission override math, scope, invite results, custom-field delete | 106 unit tests | **106 / 106 pass** |
| The app builds | `npm run build` | **green**; generated route file unchanged |
| Roster page: list, Active/Inactive, columns, click → correct person | Browser test | **pass** (after fixing the harness, F-13) |
| Add employee: step 1 → step 2 → Send 1 invite → invitations page | Browser test | **pass** |
| A DSP cannot open the roster | Browser test | **pass** |
| Hosts, HR Admin, Loans, HR Settings, Staff file, Reports all render without console errors | Render probe | **pass** |
| Internal Audit renders | Render probe | crashes **in the fake only** (its server call isn't faked) — real app not affected |

**Nobody has yet clicked, against the real tenant:** Reset password, Deactivate, Delete, live roster Apply, Face Sheet PDFs, Upload evidence, Print pack, Caseload save, Host save, any Loan save / send / sign / delete, the CSV downloads. That's the UNTESTED list. It's a morning of clicking for a human with an Owner login.

---

## Part 8 — Ten questions to ask the live database

HIVE runs on Lovable Cloud, so only a human can run SQL (Lovable → SQL editor → **Clear** before each paste). Each query returns one small result so nothing gets cut off. Replace `':org'` with the agency ID (and `':staff'` with a person's ID in Q10).

```sql
-- Q1. Is the roster healthy? (active vs inactive, anyone missing a profile, mismatches)
select count(*) filter (where m.active) as active_members,
       count(*) filter (where not m.active) as inactive_members,
       count(*) filter (where p.id is null) as members_without_profile,
       count(*) filter (where p.account_status = 'archived' and m.active) as archived_but_member_active,
       count(*) filter (where p.must_change_password) as must_change_pw
from organization_members m
left join profiles p on p.id = m.user_id
where m.organization_id = ':org';

-- Q2. Did the Roster → Settings toggles actually save? (F-1)
select id, feature_config->'staff_intake_fields' as staff_intake_fields
from organizations where id = ':org';

-- Q3. Who is the database letting edit the agency record? (F-1)
select string_agg(policyname || ' :: ' || coalesce(qual,''), ' | ')
from pg_policies where schemaname='public' and tablename='organizations' and cmd in ('UPDATE','ALL');

-- Q4. Is the Leads group / Scope feature live yet? (empty result = not live)
select string_agg(table_name || '.' || column_name, ', ')
from information_schema.columns
where table_schema='public'
  and ((table_name='profiles' and column_name in ('scope_group_id','lead_group_id'))
    or table_name in ('staff_groups','staff_group_members'));

-- Q5. How many per-person permission overrides exist?
select count(*) as overrides, string_agg(distinct permission, ', ') as perms
from user_permission_overrides where organization_id = ':org';

-- Q6. Has the agency changed any role defaults from what the code ships with?
select role, count(*) as granted, string_agg(permission, ',' order by permission)
from role_permissions where organization_id = ':org' and granted group by role;

-- Q7. Does the loans bouncer include program_manager? (confirms F-10 is withdrawn) — read the function body
select pg_get_functiondef('public.is_org_admin_or_manager(uuid,uuid)'::regprocedure);

-- Q8. Loans by status, how many signed, how many waiting on a signature
select l.status, count(*) as loans,
       count(*) filter (where exists (select 1 from employee_loan_signatures s where s.loan_id = l.id)) as signed,
       count(*) filter (where exists (select 1 from employee_loan_signature_tokens t where t.loan_id = l.id and t.used_at is null and t.expires_at > now())) as awaiting
from employee_loans l where l.organization_id = ':org' group by l.status;

-- Q9. Host cards by column, how many are also DSPs, how many have no cert
select c.status, count(*) as cards,
       count(*) filter (where c.linked_staff_user_id is not null) as also_dsp,
       count(*) filter (where not exists (select 1 from host_home_certifications h where h.hhp_cue_card_id = c.id)) as no_cert
from hhp_cue_cards c where c.organization_id = ':org' group by c.status;

-- Q10. Do one person's Staff file counts match the big Staff file table?
select i.status, count(*)
from company_obligation_instances i
join company_obligation_instance_assignees a on a.instance_id = i.id
where i.organization_id = ':org' and a.staff_id = ':staff' group by i.status;
```

---

## Appendix — The 83 permission switches, and who has them by default

"Owner" always has everything. Below, **who else** gets it out of the box. (The agency can change these; Q6 tells you if they did.)

### People & Files (52)

| Switch | Who else has it by default |
|---|---|
| Invite staff | PM, Supervisor |
| View staff records | PM, Supervisor |
| Edit staff records | PM |
| Manage staff roles | Owner only |
| Deactivate staff | Owner only |
| View staff documents | PM, Supervisor |
| Upload staff documents | PM, Supervisor |
| Approve staff documents | PM |
| View clients | PM, Supervisor |
| Edit client records | PM, Supervisor |
| Manage client intake | PM |
| View client medical info | PM, Supervisor |
| Edit client medical info | Owner only |
| View client documents | PM, Supervisor |
| Manage client documents | PM, Supervisor |
| Manage client goals | PM, Supervisor |
| Edit shift notes | PM, Supervisor |
| Approve shift notes | PM |
| View daily logs | PM, Supervisor |
| Approve daily logs | PM |
| Manage forms | Owner only |
| View form submissions | PM, Supervisor |
| Approve form submissions | PM |
| View compliance dashboard | PM, Supervisor |
| File staff documents | PM, Supervisor |
| Manage obligations | PM |
| View audit trail | Owner only |
| View incidents | PM, Supervisor |
| Manage incidents | PM, Supervisor |
| Export incident reports | Owner only |
| Manage medications | Owner only |
| View HRC | PM, Supervisor, Committee Member |
| Manage HRC | PM, Committee Member |
| Manage organization settings | Owner only |
| Manage service codes | Owner only |
| View analytics | PM, Supervisor |
| Export reports | PM |
| Manage permissions | Owner only |
| Manage roles & permissions (legacy) | Owner only |
| Assign training | Supervisor |
| Create courses | Owner only |
| Edit courses | Owner only |
| Manage certifications | Owner only |
| Manage training programs | Owner only |
| Approve external certifications | Supervisor |
| View team reports | Supervisor |
| Manage organization (legacy) | Owner only |
| View platform metrics | Owner only |
| Manage all organizations | Owner only |
| View referrals (CRM) | Owner only |
| Manage referrals (CRM) | Owner only — this is the one that locks Host cards (F-5) |
| Send emails (Resend rail) | Owner only |

### Schedule & Money (20)

| Switch | Who else has it by default |
|---|---|
| View schedule | PM, Supervisor |
| Create shifts | PM, Supervisor |
| Edit shifts | PM, Supervisor |
| Delete shifts | PM |
| Approve shift swaps | PM, Supervisor |
| Manage recurring shifts | PM |
| View team timesheets | PM, Supervisor |
| View all timesheets | PM |
| Approve timesheets | PM, Supervisor |
| Edit timesheets | PM |
| Export EVV data | PM |
| View billing | PM |
| Manage billing | Owner only |
| View payroll | PM |
| Manage payroll | Owner only |
| View financial reports | Owner only |
| Export financial reports | Owner only |
| View Financial — Gross | Owner only |
| View Financial — RHS | Owner only |
| View Financial — Employees | Owner only |

### Staff Phone Permissions (11)

These are what a regular Staff member can do on their phone. Staff has all of them by default.

| Switch | Who has it by default |
|---|---|
| View own timesheets *(the tree says "View one timesheets" — typo)* | everyone |
| Submit shift notes | everyone |
| Submit daily logs | everyone |
| Submit forms | everyone |
| Complete obligations | everyone |
| Report incidents | everyone |
| View eMAR | everyone |
| Submit eMAR | everyone |
| Upload external certifications | Owner, Supervisor, Staff (not PM) |
| View own training | Owner, Supervisor, Staff (not PM) |
| View certifications | Owner, Supervisor, Staff (not PM) |

---

## Appendix — Every tree item and its color, on one page

| Tree ID | Thing | Color |
|---|---|---|
| 2.1.1 | Team members header + counts | EXACTLY WHAT WE WANT |
| 2.1.1.1 / .1–.4 | Upload roster, the three modes, template | EXACTLY WHAT WE WANT (parsing) · UNTESTED (live apply) |
| 2.1.1.1.5 | Drop zone | UNTESTED |
| 2.1.1.2 / .1–.5, .8–.10 | Add employee form, add another, create, X | EXACTLY WHAT WE WANT |
| 2.1.1.2.1.6 | Role dropdown | NEEDS ATTENTION (F-6) |
| 2.1.1.2.1.7 | Staff type options | EXACTLY WHAT WE WANT |
| 2.1.1.3 and everything under it | Settings / Staff fields | NEEDS ATTENTION (F-1) — works for Owner only |
| 2.1.2 | Active / Inactive | EXACTLY WHAT WE WANT |
| 2.1.3.1–.7 | List columns | EXACTLY WHAT WE WANT |
| 2.1.3.7.1 | Caseload | UNTESTED · NEEDS ATTENTION (F-4) |
| 2.1.3.7.2.1–.3 | Reset password / Deactivate / Delete | UNTESTED |
| 2.1.4.1 / .2 | Back buttons | NEEDS ATTENTION (F-7) |
| 2.1.4.3.1–.4 | Face Sheet actions | UNTESTED |
| 2.1.4.4.1 | Profile section | EXACTLY WHAT WE WANT |
| 2.1.4.4.2 | Leads group / Scope | UNTESTED (check Q4) |
| 2.1.4.4.3 | Permissions 52 / 20 / 11 | EXACTLY WHAT WE WANT (grouping) · UNTESTED (live save) |
| 2.1.4.4.4 | Edit / Save / Cancel | UNTESTED (F-9 note) |
| 2.1.4.5.1–.3 | View selected / Print pack / Upload evidence | UNTESTED |
| 2.1.4.5.4.2 | Status "Missing??" | EXACTLY WHAT WE WANT — by design |
| 2.1.4.5.4.4 | View only when there's a file | EXACTLY WHAT WE WANT |
| 2.1.4.6 | Activity filters | NEEDS ATTENTION (F-8 duplicates) |
| 2.1.4.6 Incidents types | Injury / Illness labels | YET TO BREAK DOWN |
| 2.2 / 2.2.1 / 2.2.2–.4 | Hosts board, New host form, columns | EXACTLY WHAT WE WANT · UNTESTED (live save) |
| Host card edit | Greyed out with no message | NEEDS ATTENTION (F-5) |
| 2.3 / 2.3.1 | HR Admin tab, Staff file link + button | EXACTLY WHAT WE WANT |
| 2.3.1.1.1 | State Audit | YET TO BREAK DOWN |
| 2.3.1.1.2 | Reports | UNTESTED · NEEDS ATTENTION (F-2) |
| 2.3.1.1.3 | Search | EXACTLY WHAT WE WANT |
| 2.3.1.1.4 | Practice audit / Internal Audit | UNTESTED · NEEDS ATTENTION (F-2) |
| 2.3.1.1.5 | Export missing CSV | EXACTLY WHAT WE WANT (it's CSV, not PDF) |
| 2.3.1.1.6 | Export pack for selected | UNTESTED |
| 2.3.1.1.7 | Staff table → profile | EXACTLY WHAT WE WANT |
| 2.3.1.2 / 2.3.1.3 | Client file / Agency file | YET TO BREAK DOWN |
| 2.3.2 | HR Settings | NEEDS ATTENTION (F-2, F-3) — not empty, just un-run |
| 2.3.3–2.3.5 | Rollup, 0 open, 0 done | EXACTLY WHAT WE WANT |
| 2.4 | Loans tab | EXACTLY WHAT WE WANT (renders; PM access confirmed in migrations) |
| 2.4.2.x / "2.1.2.3.x" | New loan form fields | EXACTLY WHAT WE WANT (fields) · UNTESTED (save) |
| Download PDF | | UNTESTED |
| Send for e-signature | | UNTESTED · NEEDS ATTENTION (F-12) |
| 2.4.3.5.1 / .2 | Open by status (draft vs signed) | EXACTLY WHAT WE WANT |
| Loan header text | "DRAFT — pending legal review" | NEEDS ATTENTION (F-11) |
| Delete loan | | UNTESTED (works on signed loans — check with legal) |
