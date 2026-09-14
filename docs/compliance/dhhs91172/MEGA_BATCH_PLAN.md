# DHHS91172 remaining executable — mega-batch cut

Soft=none. `VERIFIED_PUBLICATIONS` stays empty. Do not invent PN1/PN2, quarterly evac, or annual-outcome parents: those live keys exist on the pack, but **no imported parent maps to them**.

Measured on main `733ec35e` after batches 1–6, Mega A, then Mega B in this PR.

| Measure | Count |
| --- | ---: |
| Imported parents | 760 |
| Executable (live key) | 50 |
| Wired 1–6 | 22 |
| Wired Mega A | 10 |
| Wired Mega B (this PR) | 9 |
| Wired total after Mega B | 41 |
| Remaining executable | 9 |
| Verified / published | 0 / 0 |
| Draft unwired | 283 |
| System behavior | 427 |

Draft-unwired blockers (283/283): **no live key + no applicability predicates**. No fixture. Not a per-row novel.

## Already wired (1–6) — do not re-cut

1. §1.8 hire clocks (5)
2. Assignment clocks (6)
3. USOR/SJD (3)
4. Monthly summaries (4)
5. Docs/EVV (2)
6. PBA financial (2)

## Mega A — already wired (10 parents)

**Family:** Article 1 provider enrollment + hire/annual credential files.

| Rule | Live key | Disposition |
| --- | --- | --- |
| REQ-1.4.1 | medicaid_enrollment | standing |
| REQ-1.4.2 | usteps_upi_accounts | standing |
| REQ-1.6 | volunteer_training_file | standing |
| REQ-1.7.1 | medicaid_101_contractor | obligation |
| REQ-1.7.2 | medicaid_manuals_memo | obligation |
| REQ-1.9.2 | background_screening_annual | obligation |
| REQ-1.9.4 | educational_credentials | obligation |
| REQ-1.9.7 | medicaid_exclusion_annual | obligation |
| REQ-1.13 | medicaid_enrollment (shared with 1.4.1) | standing |
| REQ-1.13.2 | medicaid_change_notifications | standing |

REQ-1.9.6 / `medicaid_disclosure_annual` is a live obligation key with **no imported parent** — not invented here. REQ-1.9 (umbrella) citation-collides onto `ce_12h_annual` (already batch 1) — left for Mega C.

## Mega B — THIS PR (9 parents)

**Family:** Article 1 standing org policy / process files. File-independent of Mega C.

| Rule | Live key | Disposition |
| --- | --- | --- |
| REQ-1.11 | zoning_life_safety | standing |
| REQ-1.14 | governing_board_records | standing |
| REQ-1.18 | operating_policies | standing |
| REQ-1.21 | human_rights_plan | standing |
| REQ-1.22.c | person_discharge_process | standing |
| REQ-1.23 | health_support_policies | standing |
| REQ-1.28.7 | emergency_loan_record | by_design |
| REQ-1.28.7.G | large_loan_disclosure_process | standing |
| REQ-1.28.9 | no_gifts_process | standing |

Child elements (board minutes, discharge notices, loan notices, §1.18/§1.23 items) stay on the parent. Soft=none.

## Mega C — next (9 parents)

**Family:** Person-file intake / site leftovers. Do not invent evac or annual-outcome parents.

| Rule | Live key | Note |
| --- | --- | --- |
| REQ-1.9 | ce_12h_annual | False-friend of batch 1; companion or leave unwired |
| REQ-1.10.11 | grievance_acknowledgment | intake |
| REQ-1.24.5 | support_strategies | obligation |
| REQ-1.35 | housemate_informed_choice | intake |
| REQ-11.3.5 | belongings_inventory | by_design |
| REQ-11.3.9 | hhs_room_board_agreement | intake |
| REQ-11.5 | hhs_home_cert_annual | obligation |
| REQ-21.3.1 | rhs_lease_agreement | intake |
| REQ-21.5 | ol_rhs_license_4plus | standing |

Unmapped obligation keys with **no imported parent** (do not invent): `hhs_evac_drills_quarterly`, `rhs_evac_drills_quarterly`, `pps_evac_drills_quarterly`, `hhs_annual_outcome`, `dsi_annual_outcome`, `sei_annual_outcome`, `sl_annual_outcome`, `pps_foster_license`, `medicaid_disclosure_annual`, `usor_job_development_sjd`, employment-data UPI keys, `client_specific_training`.
