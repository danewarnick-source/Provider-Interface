# B4 plan: Publish, Send changes, Copy week

Status: **approved, building** (Nov 18, 2026). Dane: yes to all 6 questions. Spec: `docs/demos/scheduler.html` › Scheduler › Publish / Send changes / Copy week. Step text: PART-B.md › B4.

## 1. Job
Nothing broken reaches staff, staff hear only about what changed for them, and next week starts from this one.

## 2. What's there today (after B3)
- **Publish button** (`board-header.tsx` → `publishWeek` in `publish.functions.ts`): publishes every draft in the week all-or-nothing and returns per-shift failures. There's no dialog and no reasons.
- **Edits to a published shift** (move, reassign, make open, cancel) save straight to the live shift, and **staff aren't told**.
- **No record of what changed**, so there's no "Changed · not sent" edge.
- **Copy week is gone.** It lived in the Nectar bar, which B3 removed.
- **Staff phone** (`dashboard.schedule.tsx`) lists published shifts and has no "your shift changed" card.

## 3. The change
**A. Change record.** When a **published** shift is edited (time, day, person, made open, cancelled, restored), the server saves one row with:
- before and after;
- who is affected (the old person and the new one);
- who made the change and when;
- when it was sent, and when each affected person tapped Got it.

Drafts that were never published make no rows. One server helper does this for every edit path (save, drag, assign, make open, cancel, restore).

**B. The board.** A shift with an unsent change gets the gold "Changed · not sent" edge (the demo's `.changed`). The header button reads **Send N changes** when there are unsent changes or drafts, and **Published ✓** when there's nothing new.

**C. Publish / Send changes dialog** (one dialog; the demo's `dlgPublish`). It checks every draft and changed shift in the week with the rule engine, in this order:
1. **Blocks** (✕), e.g. double-booking or a Block-level rule, each with **Open shift**. **Send is disabled until there are none.**
2. **Need a reason**, one reason box per shift. The reason is saved on the shift (`override_reason`) *(question 5)*.
3. **Reminders** (cards, training), shown, not blocking.
4. **Over 40 h:** the list, plus the reason it's saved to the record.
5. **Who gets a notice:** only people whose shifts are new, changed or cancelled this send. Everyone else hears nothing.
6. **Open shifts:** offered to qualified staff when sent (the existing B3 offer).

**Send** publishes the drafts, marks the changes sent, notifies the affected people (no client details in the push), and offers the open shifts. Toast: "Sent · N people notified".

**D. Staff phone.** A card for each changed shift, e.g. "Your Thu shift changed: 3p–11p → 4p–11p at Maple House", with **Got it**. Got it records the acknowledgement. Cancelled shifts say "Cancelled" with Got it.

**E. Copy week** (the demo's `dlgCopy`). Copies this week to a week you pick (next week by default, up to 4 weeks ahead) *(question 3)*. Options: **Everything** / **one home** / **community only**. Copies land as **drafts** on the same weekdays.
- **Never overwrites.** If the target week already has a shift for the same person (or the same client) overlapping that time, the copy is skipped and listed.
- If a copied shift would be **blocked** for its person (time off, an expired card, over the cap), it lands as an **open** shift instead and is listed *(question 4)*.
- **Preview first:** "41 shifts → 39 · 2 open (Theo is off Oct 25–26) · Riley would pass the 1056 by 2 h", then **Copy as drafts**. Undo removes the whole copy.

## 4. Behavior table
| Label | On click | Disabled or hidden when | User sees after |
|---|---|---|---|
| Send N changes / Published ✓ | Opens the Publish dialog | "Published ✓" when there's nothing new; hidden without `scheduling` edit | Dialog with the checklist |
| Publish › Open shift (on a block) | Opens that shift's drawer | — | Drawer; the dialog reopens on close |
| Publish › reason box | Typed per shift | — | Saved with Send |
| Publish › Send | Publishes, marks changes sent, notifies, offers open shifts | Disabled while any block remains or a required reason is empty (hover says which) | "Sent · N people notified"; button → Published ✓ |
| Publish › Not yet | Closes | — | Nothing sent |
| Copy week | Opens Copy week | Hidden without `scheduling` edit | Dialog with a preview |
| Copy › week picker / Everything / home / community | Updates the preview | — | New counts |
| Copy › Copy as drafts | Creates the drafts through the rule engine | Disabled when the preview copies 0 | "Copied N shifts to Oct 25–31 as drafts" + Undo |
| Copy › Undo | Cancels the copies (kept on record) | 10 s | "Undone" |
| Phone › Got it | Records the acknowledgement | — | The card leaves |

## 5. Data
- **New table `shift_changes`.** Reason: the before/after, sent and acknowledged record for edits to published shifts (the step's "shift-changes record"). There's no other place for it.
  - Columns: `organization_id`, `shift_id`, `affected_staff_ids uuid[]`, `before jsonb`, `after jsonb`, `changed_by`, `changed_at`, `sent_at`.
  - Acknowledgements go in `shift_change_acks (change_id, staff_id, acked_at)`, a second small table, because each person acknowledges separately *(question 1)*.
  - RLS: org-scoped. Schedulers read and write; affected staff read their own rows and insert their own ack.
- **No new column on `scheduled_shifts`.** "Changed · not sent" = has an unsent `shift_changes` row.
- **Server:** `previewPublish` / `sendChanges` replace `publishWeek`; `previewCopyWeek` / `copyWeek` are new; `ackShiftChange` is new. All go through `shift-guard.server.ts` (no checks of their own).

## 6. Delete
- `publishWeek` and its board call (replaced by `sendChanges`).
- Anything in `scheduler.functions.ts` left over from the old publish path.
- `recurrence.ts` waits for B6.

## 7. Done when (Dane on the Vercel preview)
1. Make a week with a double-booking: the Publish dialog lists it and Send is disabled. Fix it with Find staff → assign, and Send works.
2. Edit a published shift's time: its chip turns gold, and the button says "Send 1 change". Send: only that person gets a notice, and nobody else does.
3. On that person's phone view, the change card shows. Got it removes it.
4. Copy week to next week: the shifts land on the same weekdays as drafts. A shift for someone with time off that week lands as open.
5. Copy again: nothing is overwritten, and the skipped ones are listed.

## 8. Out of scope
- Rotations (B6).
- Needs you (B5; the Requests and Open shifts panels stay).
- A nightly digest *(question 2)*.
- SMS.

## Questions for Dane
1. **Two new small tables** (`shift_changes` and `shift_change_acks`) for "what changed, was it sent, did they see it"? *Recommended: yes. Nothing existing can hold it.*
2. **Notices go out right when you press Send**, with no nightly digest for now? A digest needs a scheduled job and can come later. *Recommended: yes.*
3. **Copy week target:** next week by default, with a picker for up to 4 weeks ahead? *Recommended: yes.*
4. **Copies that would be blocked** for their person land as open shifts (and get offered at Send), and are listed in the preview? *Recommended: yes.*
5. **Reasons at Send:** one reason box per shift that needs one, with an "Use this reason for all N like it" shortcut? *Recommended: yes.*
6. **Who's told about a change:** the person who had the shift and the person who has it now (if different). Cancellations tell the person who had it. *Recommended: yes.*
