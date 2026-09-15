# DHHS91172 executable finalize

Soft=none. Live-key parents are wired. `VERIFIED_PUBLICATIONS` holds the published 50. REQ-1.15.1–REQ-1.15.15 are wired unpublished (ninth batch / `upi_*` family). Publication is one rule / named READY batch via [CONTROLLED_PUBLISH.md](./CONTROLLED_PUBLISH.md) — not a mega flip. Do not invent PN1/PN2, quarterly evac, or annual-outcome parents: those live keys exist on the pack, but **no imported parent maps to them**. Do not start BC FBA/BSP batch B here.

Measured after UPI/USTEPS ninth-batch wiring on post-#355 main.

| Measure                        | Count |
| ------------------------------ | ----: |
| Imported parents               |   760 |
| Executable (live key)          |    65 |
| Wired 1–6                      |    22 |
| Wired Mega A                   |    10 |
| Wired Mega B (already on main) |     9 |
| Wired Mega C (already on main) |     9 |
| Wired ninth / UPI-USTEPS ops   |    15 |
| Wired total                    |    65 |
| Remaining executable           |     0 |
| Verified / published           | 50 / 50 |
| Draft unwired                  |   268 |
| System behavior                |   427 |

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

| Rule       | Live key                                | Disposition |
| ---------- | --------------------------------------- | ----------- |
| REQ-1.4.1  | medicaid_enrollment                     | standing    |
| REQ-1.4.2  | usteps_upi_accounts                     | standing    |
| REQ-1.6    | volunteer_training_file                 | standing    |
| REQ-1.7.1  | medicaid_101_contractor                 | obligation  |
| REQ-1.7.2  | medicaid_manuals_memo                   | obligation  |
| REQ-1.9.2  | background_screening_annual             | obligation  |
| REQ-1.9.4  | educational_credentials                 | obligation  |
| REQ-1.9.7  | medicaid_exclusion_annual               | obligation  |
| REQ-1.13   | medicaid_enrollment (shared with 1.4.1) | standing    |
| REQ-1.13.2 | medicaid_change_notifications           | standing    |

REQ-1.9.6 / `medicaid_disclosure_annual` is a live obligation key with **no imported parent** — not invented here. REQ-1.9 (umbrella) citation-collides onto `ce_12h_annual` (already batch 1) — wired in Mega C as a companion, not a second clock.

## Mega B — already on main (9 parents)

**Family:** Article 1 standing org policy / process files. File-independent of Mega C.

| Rule         | Live key                      | Disposition |
| ------------ | ----------------------------- | ----------- |
| REQ-1.11     | zoning_life_safety            | standing    |
| REQ-1.14     | governing_board_records       | standing    |
| REQ-1.18     | operating_policies            | standing    |
| REQ-1.21     | human_rights_plan             | standing    |
| REQ-1.22.c   | person_discharge_process      | standing    |
| REQ-1.23     | health_support_policies       | standing    |
| REQ-1.28.7   | emergency_loan_record         | by_design   |
| REQ-1.28.7.G | large_loan_disclosure_process | standing    |
| REQ-1.28.9   | no_gifts_process              | standing    |

Child elements (board minutes, discharge notices, loan notices, §1.18/§1.23 items) stay on the parent. Soft=none.

## Mega C — already on main (9 parents)

**Family:** Person-file intake / site leftovers. Do not invent evac or annual-outcome parents.

| Rule        | Live key                  | Note                                                       |
| ----------- | ------------------------- | ---------------------------------------------------------- |
| REQ-1.9     | ce_12h_annual             | False-friend of batch 1; companion of REQ-1.8.7 — one card |
| REQ-1.10.11 | grievance_acknowledgment  | intake                                                     |
| REQ-1.24.5  | support_strategies        | obligation                                                 |
| REQ-1.35    | housemate_informed_choice | intake                                                     |
| REQ-11.3.5  | belongings_inventory      | by_design                                                  |
| REQ-11.3.9  | hhs_room_board_agreement  | intake                                                     |
| REQ-11.5    | hhs_home_cert_annual      | obligation                                                 |
| REQ-21.3.1  | rhs_lease_agreement       | intake                                                     |
| REQ-21.5    | ol_rhs_license_4plus      | standing                                                   |

Unmapped obligation keys with **no imported parent** (do not invent): `hhs_evac_drills_quarterly`, `rhs_evac_drills_quarterly`, `pps_evac_drills_quarterly`, `hhs_annual_outcome`, `dsi_annual_outcome`, `sei_annual_outcome`, `sl_annual_outcome`, `pps_foster_license`, `medicaid_disclosure_annual`, `usor_job_development_sjd`, employment-data UPI keys, `client_specific_training`.

## Ninth — UPI / USTEPS ops (wired, unpublished)

**Family:** Article 1.15 Provider Interface / USTEPS ops. Adjacent to `usteps_upi_accounts` (REQ-1.4.2). Soft=none. Hold merge for Dane. Do not publish these 15.

| Rule        | Live key                         | Disposition |
| ----------- | -------------------------------- | ----------- |
| REQ-1.15.1  | upi_form_0_9_designee            | standing    |
| REQ-1.15.2  | upi_form_0_8_user                | standing    |
| REQ-1.15.3  | upi_need_to_know_access          | standing    |
| REQ-1.15.4  | upi_1056_decision                | standing    |
| REQ-1.15.5  | upi_1056_reject_coordinate       | standing    |
| REQ-1.15.6  | upi_1056_utilization             | by_design   |
| REQ-1.15.7  | upi_provider_organization        | standing    |
| REQ-1.15.8  | upi_staff_org_groups             | standing    |
| REQ-1.15.9  | upi_staff_notify_prefs           | standing    |
| REQ-1.15.10 | upi_person_org_groups            | standing    |
| REQ-1.15.11 | upi_remove_terminated_staff      | standing    |
| REQ-1.15.12 | upi_remove_staff_need_to_know    | standing    |
| REQ-1.15.13 | upi_remove_discharged_person     | standing    |
| REQ-1.15.14 | upi_annual_access_review         | standing    |
| REQ-1.15.15 | upi_notify_usteps_termination    | standing    |
