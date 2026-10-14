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
