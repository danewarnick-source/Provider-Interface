# DHHS91172 executable finalize

Live-key parents are wired. `VERIFIED_PUBLICATIONS` holds the published 50. REQ-1.15.1–REQ-1.15.15 are wired unpublished (ninth batch / `upi_*` family). BC §3/§4/§5 FBA/BSP twins are wired unpublished (tenth batch / shared `fba_bsp`). FY Google Form annual twins are wired unpublished (eleventh batch / annual-outcome family). OL Day Treatment / Day Support twins are wired unpublished (thirteenth batch / `ol_day_tx_license_4plus` + `ol_day_support_cert_3or_fewer`). Quarterly evac drill leftovers are wired unpublished (fourteenth batch / imported `.6` parents). Article 1 standing leftover children are wired unpublished (fifteenth batch / existing pack liveKeys). Remaining pack-key-ready leftovers are wired unpublished (sixteenth batch / incidents, HRC, service leftovers). Professional nursing leftovers are wired unpublished (seventeenth batch / invented `pm_nursing_file` + `pn_medical_care_plan`). Publication is one rule / named READY batch via [CONTROLLED_PUBLISH.md](./CONTROLLED_PUBLISH.md) — not a mega flip. Do not invent a second PN1/PN2 monthly-summary key. Do not invent umbrella REQ-8.6 / REQ-11.7 / REQ-30.7 / REQ-11.3 / REQ-20.3 / REQ-21.3 / REQ-1.17.

Measured after professional-nursing seventeenth-batch invent stacked on the #365 tip (`ec0e11f1`).

| Measure                        | Count |
| ------------------------------ | ----: |
| Imported parents               |   760 |
| Executable (live key)          |   246 |
| Wired 1–6                      |    22 |
| Wired Mega A                   |    10 |
| Wired Mega B (already on main) |     9 |
| Wired Mega C (already on main) |     9 |
| Wired ninth / UPI-USTEPS ops   |    15 |
| Wired tenth / BC FBA-BSP twins |    41 |
| Wired eleventh / FY Google Form |    34 |
| Wired twelfth / SEI-SJD UPI employment |     6 |
| Wired thirteenth / OL Day Treatment Day Support |     5 |
| Wired fourteenth / quarterly evac leftovers |     3 |
| Wired fifteenth / Article 1 standing leftover children |    45 |
| Wired sixteenth / remaining pack-key-ready leftovers |    26 |
| Wired seventeenth / professional nursing leftovers |    21 |
| Wired total                    |   246 |
| Remaining executable           |     0 |
| Verified / published           | 50 / 50 |
| Draft unwired                  |    93 |
| System behavior                |   421 |

Draft-unwired blockers (93/93): **no live key + no applicability predicates**. No fixture. Not a per-row novel. Remaining rows need a new pack key or invented SOW — leave them invent-blocked.

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

Unmapped obligation keys with **no imported parent** (do not invent): `client_specific_training`. `pps_foster_license` now attaches to leftover REQ-20.5.1 / REQ-20.5.2 (sixteenth batch). `usor_job_development_sjd` now attaches to leftover REQ-33.5.a (sixteenth batch). `medicaid_disclosure_annual` now attaches to leftover REQ-1.13.5 (fifteenth batch) — do not invent REQ-1.9.6. Quarterly evac pack keys now attach to imported `.6` parents (fourteenth batch) — do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3. Employment-data / strategies / USOR-contact UPI keys now attach to imported SEI/SJD leftovers (twelfth batch). Annual-outcome pack keys attach to imported FY Google Form `.c` twins (eleventh batch) — do not invent umbrella REQ-8.6 / REQ-11.7 / REQ-30.7. There is no `sjd_employment_strategies_upi` pack sibling (that would need a catalog seed).

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

## Tenth — BC FBA/BSP twins (wired, unpublished)

**Family:** Articles 3–5 FBA/BSP twins. One live key: `fba_bsp` (existing by_design behavior-support module). Soft=none. Hold merge for Dane. Do not publish these 41. Do not invent SOW text. Rights-modification twins REQ-3.4.3 / REQ-4.4.3 / REQ-5.4.3 stay unwired (not FBA/BSP). UPI 1.15 stays on the ninth batch.

| Rule | Live key | Twin |
| ---- | -------- | ---- |
| REQ-3.3.1, REQ-4.3.1, REQ-5.3.1 | fba_bsp | Complete FBA of the Person's target behavior |
| REQ-3.3.2, REQ-4.3.2, REQ-5.3.2 | fba_bsp | Written FBA that includes (SYSTEM fields) |
| REQ-3.3.3, REQ-4.3.3, REQ-5.3.3 | fba_bsp | Initial FBA within 30 Calendar Days of BC approval |
| REQ-3.3.4, REQ-4.3.4, REQ-5.3.4 | fba_bsp | FBA reevaluation within 30 Calendar Days |
| REQ-3.3.5, REQ-4.3.5, REQ-5.3.5 | fba_bsp | Submit FBA within 14 Calendar Days |
| REQ-3.3.6, REQ-5.3.6 | fba_bsp | Maintain the FBA in the Person's file (BC2 has no twin) |
| REQ-3.3.7, REQ-4.3.6, REQ-5.3.7 | fba_bsp | Initial FBA after substantial life change (60 Calendar Days) |
| REQ-3.3.8, REQ-4.3.7, REQ-5.3.8 | fba_bsp | FBA revisions within 30 Calendar Days of the change |
| REQ-3.4.1, REQ-4.4.1, REQ-5.4.1 | fba_bsp | BSP development / implementation / training (SYSTEM fields) |
| REQ-3.4.2, REQ-4.4.2, REQ-5.4.2 | fba_bsp | Reevaluate the BSP each month |
| REQ-3.4.4, REQ-4.4.4, REQ-5.4.4 | fba_bsp | Complete the BSP within 30 Calendar Days of FBA completion |
| REQ-3.4.5, REQ-4.4.5, REQ-5.4.5 | fba_bsp | BSP reevaluation within 30 Calendar Days / 30 days |
| REQ-3.4.6, REQ-4.4.6, REQ-5.4.6 | fba_bsp | Submit BSP within 14 Calendar Days |
| REQ-3.4.7, REQ-4.4.7, REQ-5.4.7 | fba_bsp | Maintain the BSP in the Person's file |

## Eleventh — FY Google Form annual twins (wired, unpublished)

**Family:** Service-article fiscal-year Google Form / August 30 / 60-days-after-FY-end twins. Same card shape as `fba_bsp`. Reuses existing pack keys where they already fit. Other articles share the `hhs_annual_outcome` family card. Unpublished. Hold merge for Dane. Do not publish these 34. Do not invent SOW text. Do not invent umbrella REQ-8.6 / REQ-11.7 / REQ-30.7. REQ-18.6.c / REQ-19.6.c are FY-form twins only — do not invent PN1/PN2 monthly-summary keys. Do not start Cluster B (SEI/SJD UPI employment).

| Rule | Live key | Awarded codes |
| ---- | -------- | ------------- |
| REQ-11.7.c plus the 29 twins without a dedicated pack title | hhs_annual_outcome | article awarded codes |
| REQ-8.6.c | dsi_annual_outcome | DSI |
| REQ-30.7.c | sei_annual_outcome | SEI |
| REQ-31.5.c | sl_annual_outcome | SLH |
| REQ-32.7.c | sl_annual_outcome | CMP, CMS, SLN |

## Twelfth — SEI/SJD UPI employment leftovers (wired, unpublished)

**Family:** Article 30/33 employment-file leftovers. App PR, no DB change. Unpublished. Hold merge for Dane. Do not publish these 6. Official catalog clauses only. Adjacent to wired REQ-30.3.4 / REQ-33.3.4 monthly summaries. Staff never touch UPI. Do not include FY Google Form Cluster A REQs.

| Rule | Live key | Awarded | Note |
| ---- | -------- | ------- | ---- |
| REQ-30.3.5 | sei_employment_data_upi | SEI | unused pack key |
| REQ-30.3.6 | sei_employment_strategies_upi | SEI | unused pack key |
| REQ-33.3.5 | sei_employment_strategies_upi | SJD | shares strategies key — pack has no SJD sibling |
| REQ-33.3.7 | sjd_employment_data_upi | SJD | unused pack key |
| REQ-33.3.1 | sjd_usor_contact_monthly | SJD | optional, existing pack key |
| REQ-33.3.4.I | sjd_usor_contact_monthly | SJD | optional, shares USOR contact card |

## Thirteenth — OL Day Treatment / Day Support twins (wired, unpublished)

**Family:** Article 7/8/9 OL Day Treatment license (4+) and Day Support certification (3 or fewer). App PR, no DB change. Unpublished. Hold merge for Dane. Do not publish these 5. Official catalog clauses only. Same standing OL-file shape as wired REQ-21.5 / `ol_rhs_license_4plus`. Community-based certification reuses `ol_day_support_cert_3or_fewer` — do not mint a third community-based key. Do not invent umbrella REQ-1.4.3 / REQ-1.34. Hold out REQ-10.5, grandfather REQ-7.5.c / REQ-8.5.c / REQ-9.6.b, and vague-comply twins REQ-7.3.5 / REQ-8.3.3 / REQ-9.3.5. Do not start Cluster #2 (evac).

| Rule | Live key | Awarded | Note |
| ---- | -------- | ------- | ---- |
| REQ-7.5.a | ol_day_tx_license_4plus | DSG, DSP | site-based; unused pack key |
| REQ-7.5.b | ol_day_support_cert_3or_fewer | DSG, DSP | community; reuses 3-or-fewer key |
| REQ-8.5.a | ol_day_tx_license_4plus | DSI | site-based; shares license key |
| REQ-8.5.b | ol_day_support_cert_3or_fewer | DSI | community; shares cert key |
| REQ-9.6.a | ol_day_tx_license_4plus | EPR | shares license key |

## Fourteenth — quarterly evac drill leftovers (wired, unpublished)

**Family:** Imported `.6` site drill-log leftovers. Same leftover move as FY `.c` twins. One drill-log card family, quarter-end, awarded-code predicates. App PR, no DB change. Unpublished. Hold merge for Dane. Do not publish these 3. Official catalog clauses only. Reuses existing pack liveKeys. Do not invent umbrella REQ-11.3 / REQ-20.3 / REQ-21.3. Do not include OL Day twins.

| Rule | Live key | Awarded | Note |
| ---- | -------- | ------- | ---- |
| REQ-11.3.6 | hhs_evac_drills_quarterly | HHS | imported `.6` parent; unused pack key |
| REQ-20.3.6 | pps_evac_drills_quarterly | PPS | imported `.6` parent; unused pack key |
| REQ-21.3.6 | rhs_evac_drills_quarterly | RHS | imported `.6` parent; unused pack key |

## Fifteenth — Article 1 standing leftover children (wired, unpublished)

**Family:** MEGA A leftover-child attach. Same leftover move as FY `.c` twins and evac `.6`. Children stay on the existing parent card. Reuse existing predicates. App PR, no DB change. Unpublished. Hold merge for Dane. Do not publish these 45. Official catalog clauses only. Reuses existing pack liveKeys. Do not invent umbrella REQ-1.17 / REQ-1.9.6. REQ-1.13.4 stays invent-blocked. REQ-1.28.6 now attaches on the sixteenth batch / `rights_restriction_record`.

| Rule | Live key |
| ---- | -------- |
| REQ-1.6.1, REQ-1.6.2.B, REQ-1.6.3, REQ-1.6.3.B, REQ-1.6.3.F | volunteer_training_file |
| REQ-1.7.3, REQ-1.7.4 | medicaid_manuals_memo |
| REQ-1.13.1, REQ-1.13.3 | medicaid_change_notifications |
| REQ-1.13.5 | medicaid_disclosure_annual |
| REQ-1.14.1–REQ-1.14.4 | governing_board_records |
| REQ-1.17.a, REQ-1.17.b | personnel_policies |
| REQ-1.18.2, REQ-1.18.5, REQ-1.18.7 | operating_policies |
| REQ-1.22.a, REQ-1.22.a.6, REQ-1.22.b.3, REQ-1.22.b.4, REQ-1.22.c.1–3, REQ-1.22.d | person_discharge_process |
| REQ-1.23.a, REQ-1.23.e, REQ-1.23.f.1, REQ-1.23.g.1 | health_support_policies |
| REQ-1.23.b, REQ-1.23.c, REQ-1.23.d, REQ-1.23.d.2 | medication_record |
| REQ-1.23.h | medical_dental_exams |
| REQ-1.28.7.A–D, REQ-1.28.7.H–I | emergency_loan_record |
| REQ-1.30.2, REQ-1.30.3, REQ-1.30.3.G | driving_record_transport |

## Sixteenth — remaining pack-key-ready leftovers (wired, unpublished)

**Family:** Incidents + HRC + service leftovers. Same leftover-child attach as FY `.c`, evac `.6`, and Article 1 standing children. Children stay on the existing parent card. Reuse existing predicates. App PR, no DB change. Unpublished. Hold merge for Dane. Do not publish these 26. Official catalog clauses only. Reuses existing pack liveKeys. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only. Do not invent pack keys. Ceiling after MEGA A was 26 pack-key-ready imported parents — every remaining attachable row is in this batch.

| Rule | Live key |
| ---- | -------- |
| REQ-1.27.1, REQ-1.27.1.A, REQ-1.27.1.B, REQ-1.27.2, REQ-1.27.3, REQ-1.27.4, REQ-1.27.5, REQ-1.27.6 | incident_reporting_process |
| REQ-1.20.a | hrc_committee |
| REQ-1.20.b, REQ-1.20.b.6, REQ-1.28.6, REQ-1.33.2 | rights_restriction_record |
| REQ-20.3.5, REQ-21.3.7, REQ-31.3.3 | belongings_inventory |
| REQ-20.3.9 | pps_room_board_agreement |
| REQ-20.5.1, REQ-20.5.2 | pps_foster_license |
| REQ-15.3.1, REQ-15.3.6, REQ-15.3.8, REQ-15.3.9, REQ-15.3.10 | pba_financial_review |
| REQ-12.4 | hsq_safe_environment |
| REQ-33.5.a | usor_job_development_sjd |

## Seventeenth — professional nursing leftovers (wired, unpublished)

**Family:** MEGA invent-1. PM1/PM2 twins plus PN1/PN2 medical-care-plan leftovers. Invents `pm_nursing_file` and `pn_medical_care_plan`. Children stay on the parent card. Reuse awarded-code predicates (FACT-023 / FACT-024 / FACT-037 / FACT-014). App PR. Pack-changelog seed only — no schema change. Unpublished. Hold merge for Dane. Do not publish these 21. Official catalog clauses only. REQ-19.2.10 stays a leftover child on the care-plan card — do not invent a PN1/PN2 monthly-summary key. Never delete MAR/eMAR. Punch pad stays the incident clock. Staff never touch UPI. EVV stays CSV only.

| Rule | Live key |
| ---- | -------- |
| REQ-16.2.3, REQ-16.2.7, REQ-16.2.8, REQ-16.2.9, REQ-16.4 | pm_nursing_file |
| REQ-17.2.3, REQ-17.2.7, REQ-17.2.8, REQ-17.2.9, REQ-17.4 | pm_nursing_file |
| REQ-18.2.3, REQ-18.5, REQ-19.2.7, REQ-19.2.8, REQ-19.2.8.A, REQ-19.2.8.B, REQ-19.2.9.A, REQ-19.2.9.B, REQ-19.2.10, REQ-19.5.a, REQ-19.5.b | pn_medical_care_plan |
