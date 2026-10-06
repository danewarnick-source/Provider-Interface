# Compliance + training storage cutlist (Phase 1)

Inventory of public tables that are compliance- or training-ish. Disposition
is the **target** after later phases — **this PR drops nothing** and does
**not** switch production reads.

Layered SOW model the new core must support (defs/instances only; no invented
SOW text, no punch/EVV tables):

| Layer | Meaning | Storage |
| --- | --- | --- |
| All-staff clocks | Hire / annual clocks every DSP gets | `requirement_defs` + `obligation_instances` |
| Staff profile SHELF | Personnel-file presence (not a task list) | same + `file_records` / `attestations` |
| Staff Exceptions | ABI / behavior-cert **gates** | `org_facts` + applicability cache |
| Code-specific work-product | Notes, EVV, timeclock | **Stay on existing shift/EVV tables** |
| Client shelf + signatures | Client-file presence + signs | `obligation_instances` (subject=client) |
| Company standing | Org/site standing artifacts | `obligation_instances` (subject=org\|site) |

Transport pack is **DEFAULT ON** for all staff. Rare opt-out is an
`org_facts` row `does_not_transport` (subject=staff). Absence of that fact
means the person transports.

Statuses on the new instance table: `missing` \| `due` \| `complete` \| `waived`.

## New core (this PR — empty, unused by app reads)

| table | role |
| --- | --- |
| `requirement_defs` | Catalog / overlay: `requirement_key`, subject, layer, SOW cite |
| `org_facts` | Gate facts (org/staff/client/site), incl. transport opt-out |
| `file_records` | Evidence file refs |
| `obligation_instances` | Per-subject clock / shelf row + status + due_at |
| `obligation_instance_assignees` | Optional assignees |
| `attestations` | Human attestations (never auto-publish) |
| `training_runs` | One training attempt / completion |
| `reviews` | Advisory / human / audit review |
| `requirement_applicability` | Optional computed applicability cache |

## Disposition key

- **KEEP** — stays the system of record (or a different product). Do not fold.
- **MERGE_INTO:\<new\>** — later dual-write then cut over. Keep live until then.
- **FREEZE** — writers already no-op or stack is retired; leave table, no new writes.
- **DROP_LATER** — candidate to archive after grep + row-count gate. **Not this PR.**

Sources: `src/integrations/supabase/types.ts`, `docs/audits/SCHEMA_AUDIT.md`,
`supabase/migrations/`, app `.from()` / edge-function call sites.

---

## Company obligations / packs / remediation

| table | disposition | reason |
| --- | --- | --- |
| `company_obligations` | MERGE_INTO:requirement_defs | Live catalog of clocks; production reads stay here. |
| `company_obligation_instances` | MERGE_INTO:obligation_instances | Live per-period status desk (77+ rows). |
| `company_obligation_instance_assignees` | MERGE_INTO:obligation_instance_assignees | Snapshot assignees. |
| `company_obligation_completions` | MERGE_INTO:attestations | Individual completions + upload paths. |
| `obligation_packs` | MERGE_INTO:requirement_defs | Pack/tab metadata; layer later. |
| `obligation_applicability` | MERGE_INTO:requirement_applicability | Step-5 computed org-fact applicability. |
| `pack_changelog` | KEEP | Platform pack version log (not org PHI). |
| `escalation_rules` | KEEP | Notification rules, not the register. |
| `remediation_plans` | MERGE_INTO:reviews | Lapse plans / outcomes. |
| `compliance_overrides` | MERGE_INTO:obligation_instances | Waive / override log → `waived` later. |
| `agreement_requirements` | MERGE_INTO:requirement_defs | Org agreement checklist defs. |

## Nectar requirements / compliance parallel

| table | disposition | reason |
| --- | --- | --- |
| `nectar_requirements` | MERGE_INTO:requirement_defs | 1768-row imported catalog; cite-only later. |
| `nectar_requirement_mappings` | MERGE_INTO:requirement_defs | Feature-link map; fold into def metadata. |
| `nectar_requirement_usage` | FREEZE | Writers already no-op (spine). |
| `nectar_requirement_usage_current_v` | FREEZE | View over frozen usage. |
| `nectar_requirement_category_history` | FREEZE | Category edits; unused. |
| `nectar_requirement_approval_events` | MERGE_INTO:reviews | Approval trail. |
| `nectar_compliance_rules` | FREEZE | Parallel register; propose/update no-op. |
| `nectar_compliance_rule_history` | FREEZE | History of frozen rules. |
| `nectar_compliance_flags` | FREEZE | Punch/shift writers retired. |
| `nectar_compliance_instances` | MERGE_INTO:obligation_instances | Parallel instances; create path gone. |
| `nectar_attestations` | KEEP | Punch-note expansion, not the compliance register. |
| `nectar_documents` | KEEP | Authoritative source files (OCR), not staff evidence. |
| `nectar_extracted_fields` | KEEP | Source-doc OCR fields. |
| `nectar_code_activations` | KEEP | Service-code activation, not clocks. |
| `nectar_draft_jobs` | KEEP | Nectar job runner. |
| `nectar_guides` | KEEP | Onboarding guide content. |
| `nectar_guide_tasks` | KEEP | Guide task rows. |
| `nectar_rate_state` | KEEP | Token rate limiter. |
| `nectar_report_runs` | KEEP | Saved-report execution. |
| `nectar_report_schedules` | KEEP | Report cadence. |
| `nectar_saved_reports` | KEEP | Report defs. |

## Attestations / signatures (existing)

| table | disposition | reason |
| --- | --- | --- |
| `document_attestations` | MERGE_INTO:attestations | Policy/doc acknowledgements. |
| `policy_signatures` | MERGE_INTO:attestations | Policy sign-off. |
| `upi_attestations` | KEEP | UPI portal ops (admin-only), not staff shelf. |
| `legal_attestations` | KEEP | Signup TOS/BAA, not SOW clocks. |
| `org_loan_attestations` | KEEP | Loan product, not training/compliance register. |
| `program_acknowledgements` | MERGE_INTO:attestations | LMS program ack. |

## Training / LMS / CE (parallel stacks)

| table | disposition | reason |
| --- | --- | --- |
| `training_completions` | MERGE_INTO:training_runs | In-Hive + upload completions. |
| `training_topic_progress` | MERGE_INTO:training_runs | Per-topic progress (30-day / PCT / ABI). |
| `training_person_modules` | MERGE_INTO:training_runs | Person-module assignments. |
| `user_training_progress` | MERGE_INTO:training_runs | Legacy LMS progress. |
| `lesson_progress` | MERGE_INTO:training_runs | In-app LMS lesson progress. |
| `lesson_quiz_attempts` | MERGE_INTO:training_runs | Quiz attempts. |
| `staff_baseline_training_completions` | MERGE_INTO:training_runs | Baseline checklist completions. |
| `staff_checklist_completion` | MERGE_INTO:obligation_instances | HR checklist ticks. |
| `hive_training_assignments` | MERGE_INTO:training_runs | Paid-seat assignment state. |
| `hive_training_module_progress` | MERGE_INTO:training_runs | Paid-course module progress. |
| `hive_training_certificates` | MERGE_INTO:file_records | Issued cert artifacts. |
| `ce_ledger` | MERGE_INTO:training_runs | Manual training-hour entries still written. |
| `ce_modules` | FREEZE | CE generation product removed from app. |
| `ce_settings` | FREEZE | CE product settings leftover. |
| `staff_training_hours_entries` | DROP_LATER | Unused; fold SQL exists, **not** applied live. |
| `certifications` | MERGE_INTO:file_records | Internal cert rows. |
| `certification_types` | KEEP | Type catalog for tracks. |
| `external_certifications` | MERGE_INTO:file_records | Uploaded external certs. |
| `client_specific_trainings` | MERGE_INTO:obligation_instances | Client-shelf training. |
| `training_checklist_mappings` | MERGE_INTO:requirement_defs | Topic ↔ checklist key map. |
| `courses` | KEEP | In-app LMS content (364 lessons). |
| `course_modules` | KEEP | LMS structure. |
| `course_assignments` | KEEP | LMS assignment graph. |
| `lessons` | KEEP | LMS content. |
| `training_tracks` | KEEP | Track catalog UI. |
| `track_programs` | KEEP | Track composition. |
| `track_assignments` | KEEP | Track enrollment. |
| `training_topics` | KEEP | Topic content catalog. |
| `training_programs` | KEEP | Program catalog. |
| `program_courses` | KEEP | Program composition. |
| `program_assignments` | KEEP | Program enrollment. |
| `training_modules` | KEEP | Legacy public training content. |
| `provider_training_modules` | KEEP | Provider-authored modules. |
| `hive_training_catalog` | KEEP | Commerce catalog. |
| `hive_training_courses` | KEEP | Commerce course defs. |
| `hive_training_course_modules` | KEEP | Commerce modules. |
| `hive_training_seats` | KEEP | Seat inventory (billing). |
| `hive_training_orders` | KEEP | Stripe orders (edge functions). |
| `hive_training_order_items` | KEEP | Order lines. |
| `hive_training_renewal_intents` | KEEP | Auto-renew intents. |
| `hive_training_auto_renew_settings` | KEEP | Auto-renew config. |
| `hive_training_auto_renew_runs` | KEEP | Auto-renew run log. |
| `org_training_orders` | KEEP | Org training checkout. |
| `training_classes` | KEEP | Class scheduling (not the register). |
| `training_class_roster` | KEEP | Class roster / seats. |
| `training_only_orders` | KEEP | Public training-only commerce. |
| `training_only_seats` | KEEP | Training-only seats. |
| `training_products` | FREEZE | Unapplied duplicate commerce stack. |
| `training_purchases` | FREEZE | Unapplied; app still has call sites. |
| `training_enrollments` | FREEZE | Unapplied; do not apply as a second LMS. |

## State / pack / onboarding sources

| table | disposition | reason |
| --- | --- | --- |
| `state_derived_requirements` | MERGE_INTO:requirement_defs | Derived catalog rows. |
| `state_requirement_sources` | KEEP | Citation sources (not instances). |
| `state_structural_gaps` | KEEP | Onboarding gap tracker. |
| `state_templates` | KEEP | State pack templates. |
| `state_onboarding_sessions` | KEEP | Onboarding session state. |
| `hive_base_template_versions` | KEEP | Platform template versions. |
| `platform_states` | KEEP | 50-state reference. |

## Org operating facts (columns, not a table today)

| object | disposition | reason |
| --- | --- | --- |
| `organizations.fact_operates_ol_site` | MERGE_INTO:org_facts | Setup / applicability fact. |
| `organizations.fact_uses_volunteers` | MERGE_INTO:org_facts | Setup / applicability fact. |
| `organizations.fact_has_governing_board` | MERGE_INTO:org_facts | Setup / applicability fact. |
| `organizations.fact_answers_updated_at` | MERGE_INTO:org_facts | Audit stamp on facts. |
| `organizations.fact_answers_updated_by` | MERGE_INTO:org_facts | Audit stamp on facts. |

Columns stay. New `org_facts` is the normalized home; no column drop this PR.

## Adjacent file cabinets (not the new evidence table)

| table | disposition | reason |
| --- | --- | --- |
| `hr_documents` | KEEP | Staff PII docs; later some evidence may also `file_records`. |
| `hr_document_access_log` | KEEP | Access log. |
| `employee_documents` | KEEP | Employee uploads / date detect. |
| `client_documents` | KEEP | Client file cabinet. |
| `audit_files` | KEEP | Internal audit cabinet. |
| `audit_file_documents` | KEEP | Cabinet children. |
| `audit_packets` / `audit_packet_items` | KEEP | Internal packet product. |
| `audit_packages*` / `auditor_*` | KEEP | External auditor portal. |
| `import_cert_documents` | KEEP | Smart-import cert inbox. |
| `import_documents` | KEEP | Import pipeline. |

## Explicit KEEP — code-specific work-product (do not new-table)

Punch notes, EVV, and timeclock stay on existing shift/EVV tables.

| table | disposition | reason |
| --- | --- | --- |
| `evv_timesheets` | KEEP | Punches / EVV evidence. |
| `evv_export_batches` | KEEP | UEVV export. |
| `evv_export_records` | KEEP | UEVV lines. |
| `scheduled_shifts` | KEEP | Calendar plan. |
| `general_shifts` | KEEP | Non-EVV payroll time. |
| `daily_logs` | KEEP | Unified daily notes. |
| `shift_reports` | KEEP | Shift narrative. |
| `shift_completeness_flags` | KEEP | Punch completeness. |
| `client_progress_summaries` | KEEP | Code-specific summaries / UPI. |
| `forms` / `form_submissions` / `form_notifications` | KEEP | Evidence channel, not the register. |
| `submitted_forms` | DROP_LATER | Unused `as never` leftovers after call sites die. |

## Residential / host / HRC standing (mostly KEEP)

| table | disposition | reason |
| --- | --- | --- |
| `host_home_certifications` | MERGE_INTO:obligation_instances | Site/company standing artifact. |
| `host_home_cert_concerns` | KEEP | Cert review notes. |
| `hhs_monthly_certifications` | KEEP | Residential billing cert, not staff shelf. |
| `hrc_reviews` | KEEP | HRC workflow. |
| `hrc_meetings` / `hrc_committee_members` / `hrc_restriction_records` | KEEP | HRC product. |
| `incident_reports` | KEEP | Incident product (not a clock). |
| `hhs_incident_reports` | KEEP | HHS hub incidents; fold later if product asks. |

## Phase 1 rules (locked)

1. No table or column drops in this phase.
2. Production reads stay on `company_obligations*` / existing training tables.
3. New writers are stubs only — not imported by live desks.
4. Do not invent SOW text or seed `requirement_defs`.
5. Do not restore mar-calendar. Do not hard-reset.
6. Hold merge for Dane.
