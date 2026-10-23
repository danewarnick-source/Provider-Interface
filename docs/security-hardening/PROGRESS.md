# Security hardening — progress

Runbook: `docs/security-hardening/RUNBOOK.md` on branch `security-hardening-runbook`.

## Part CS (on `clients-rebuild`)

### CS1 — Nectar never writes client records unreviewed; staff see only what they should
Merged Oct 14, 2026 as PR #487 (squash 8297a39d). No migrations; no policy, function or trigger changed.
- **Uploads:** BSP, MAR and DNR/POLST/palliative/hospice uploads save the file, then show a review list, and only ticked rows apply. `extractAndApplyClientUpload` is deleted. The bucket is fixed on the server and the path is checked against the client's folder. Guarded by `assertCanManageClient`; medical rows need Client medical access. Codes, goals, home and the discharge date are never written from it. Uploads now go under the org folder, which the live storage rule requires.
- **Staff view:** `getClientCareData` returns identity, contacts and the full med list only with Clients / Client medical view; everyone else gets `staffCare` only. The face sheet needs `view_medical`, logs PHI access, and its button is hidden from staff.
- **Training:** each training function takes `organizationId`, checks membership in it, and uses `assertCanManageClient` for writes, so a scoped admin's scope applies.
- **Soft delete:** `deleted_at`, `deleted_by` and `delete_reason` are locked. The guard rejects deleted clients except for an Owner's restore.
- **PCSP codes:** confirming a PCSP writes codes only with billing edit. Without it, everything else saves with "Ask someone with billing access to confirm the service codes."
- **Meds:** the Health-setup MAR upload lists one row per medication through the existing import writer. M3–M5 server functions are untouched, and M4 still reads `staffCare.medications`.
- **Checks:** build passes; tsc stays at 203 errors. Unit tests went from 2385 pass / 5 fail to 2424 pass / 5 fail (same baseline 5). Rolled-back live SQL checks are in the PR body.
- **Open:** `setEndOfLifeStatus`, `appendClientArrayField` and the HRC/level-of-need functions still use the level-only admin check. A manual Add client still writes codes with Clients:Edit only.

### CS2 — Broken or fragile writes
Merged Oct 14, 2026 as PR #488 (squash 36101f5a). Migrations, applied live and recorded:
- `20261014050824_cs2_apply_reviewed_pcsp_one_transaction`
- `20261014051241_cs2_hrr_clear_signatures_when_answers_change`
- `20261014051621_cs2_support_strategies_draft_content`

No RLS policies changed.
- **HRR upload:** HRR documents upload to `<org>/<client>/hrc_approval/`, and the server checks that folder.
- **Dates:** `todayYmd()` is the Denver date. A new `localYmd()` formats plain calendar dates. The UTC "today" spots are fixed. Billing codes and shift care data keep a code on its last authorized day (`>=`).
- **1056 upload:** the PDF uploads to storage first, and the server receives only its path.
- **Atomic writes:**
  - PCSP confirm runs as one SQL function, `apply_reviewed_pcsp`. It is SECURITY DEFINER, re-checks Clients and Billing edit, and can't be executed by anon. A forced mid-confirm error left the old plan current.
  - A strategies send is inserted first, then the Evidence copy is filed. The send is voided if filing fails.
  - The HRR trigger clears signatures when the title or answers change. The JS clearing (`withSignaturesCleared`) is deleted.
- **Strategies pull:** pulling strategies over approved ones saves to `draft_content`, so staff keep seeing the approved version. A "Discard draft" button was added.
- **Checks:** build passes; tsc stays at 203 errors. Unit tests went from 2424 pass / 5 fail to 2469 pass / 5 fail (the same 5 baseline failures). The rolled-back live SQL checks are in the PR body.
- **Open:**
  - The scheduler and some other screens still drop a code on its end date. Only the two named places were changed.
  - The existing `discharge_client` needs a signed-in user, so it may fail where AWS server functions use a trusted client.
  - A 1056 that fails its checks after uploading stays in storage with no document record.

### CS3 — Records are kept, and every write checks scope
Merged Oct 14, 2026 as PR #489 (squash ac1e336c). Migrations, applied live and recorded:
- `20261014054824_cs3_loans_void_instead_of_delete`
- `20261014054828_cs3_custom_field_definitions_archive`

Both add nullable columns plus triggers: a void needs a reason and is final, and an archived field refuses new values. No policies changed.
- **Loan voids:** loans and their entries are voided with a reason, never deleted. Balances, counts and the PDF leave voided entries out of the math. The editor, the Money section, the Client loans page and the PDF still list them struck through, with the reason.
- **Custom field archive:** field definitions are archived instead of deleted, and can be restored. Old values still show, labelled "(archived field)".
- **Custom field scope:**
  - Setting a client's custom field value runs `assertCanManageClient(edit)`.
  - Team member fields check Team roster: Edit, membership in the agency, and the caller's scope.
- **Pins, visibility and loans:**
  - Home pin and staff visibility add the scope guard through `assertCanManageClientById`.
  - Loan writes add `edit_loans`. A loan can't move to another client, and a new ledger entry checks the loan is in the agency.
- **CS1 leftovers:**
  - End-of-life status, allergies and immunizations need `edit_medical`.
  - Level of need and grievance need `edit`, and the grievance date uses `denverYmd`.
  - HRC uses `view_hrc` / `edit_hrc`.
  - `signClientDocument` adds the scope check.
- **Checks:** build passes; tsc stays at 203. Unit tests went from 2469 pass / 5 fail to 2495 pass / 5 fail, the same baseline 5. Rolled-back live SQL checks are in the PR body.
- **Open:**
  - Which category `signClientDocument` should need (Clients or Client medical) is a design decision, so it's left as is.
  - Live has no assigned-scope admin, so that refusal was tested with a temporary scope change in a rolled-back transaction.
  - The delete policies on loans and field definitions should be removed in a Phase B once this reaches main.

**Part CS complete.**
