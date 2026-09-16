/**
 * Phase 1 compliance + training core-store stubs.
 *
 * Production reads stay on company_obligations* / nectar_* / training_*.
 * These writers exist so later dual-write can import them. They do not
 * insert, update, or select any table.
 */

export const COMPLIANCE_STORE_PHASE1_STUB =
  "phase1_stub: core tables exist in SQL only; production reads are unchanged";

export const COMPLIANCE_STORE_TABLES = [
  "requirement_defs",
  "org_facts",
  "file_records",
  "obligation_instances",
  "obligation_instance_assignees",
  "attestations",
  "training_runs",
  "reviews",
  "requirement_applicability",
] as const;

export type ComplianceStoreTable = (typeof COMPLIANCE_STORE_TABLES)[number];

export type ComplianceSubjectKind = "staff" | "client" | "org" | "site";

export type ComplianceInstanceStatus = "missing" | "due" | "complete" | "waived";

export type ComplianceRequirementLayer =
  | "all_staff_clock"
  | "staff_shelf"
  | "staff_exception"
  | "code_work_product"
  | "client_shelf"
  | "company_standing";

/** Rare staff opt-out. Absence of this fact means the person transports. */
export const TRANSPORT_OPT_OUT_FACT_KEY = "does_not_transport";

export type ComplianceStoreWriteResult = {
  written: false;
  reason: typeof COMPLIANCE_STORE_PHASE1_STUB;
};

const stub = (): ComplianceStoreWriteResult => ({
  written: false,
  reason: COMPLIANCE_STORE_PHASE1_STUB,
});

export type RequirementDefWrite = {
  organizationId: string | null;
  requirementKey: string;
  subjectKind: ComplianceSubjectKind;
  layer: ComplianceRequirementLayer;
  title?: string;
  sourceSowCite?: string | null;
  gateFactKey?: string | null;
  defaultOn?: boolean;
};

export type OrgFactWrite = {
  organizationId: string;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  factKey: string;
  factValue?: unknown;
  source?: "recorded" | "computed" | "override";
};

export type ObligationInstanceWrite = {
  organizationId: string;
  requirementKey: string;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  status: ComplianceInstanceStatus;
  dueAt?: string | null;
  sourceSowCite?: string | null;
  gateFactKey?: string | null;
  periodKey?: string | null;
  evidenceFileId?: string | null;
};

export type ObligationAssigneeWrite = {
  organizationId: string;
  instanceId: string;
  staffId: string;
  staffName?: string | null;
  staffRole?: string | null;
};

export type FileRecordWrite = {
  organizationId: string;
  instanceId?: string | null;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  requirementKey?: string | null;
  storagePath: string;
  filename?: string | null;
};

export type AttestationWrite = {
  organizationId: string;
  instanceId?: string | null;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  requirementKey?: string | null;
  attestedBy: string;
  attestationTextSnapshot?: string | null;
};

export type TrainingRunWrite = {
  organizationId: string;
  instanceId?: string | null;
  subjectKind?: ComplianceSubjectKind;
  subjectId: string;
  requirementKey?: string | null;
  sourceSystem?: "unwired" | "in_hive" | "hive_training" | "external" | "manual_entry";
  courseKey?: string | null;
};

export type ReviewWrite = {
  organizationId: string;
  instanceId?: string | null;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  requirementKey?: string | null;
  reviewKind?: "nectar_advisory" | "human" | "audit";
  notes?: string | null;
};

export type ApplicabilityWrite = {
  organizationId: string;
  requirementKey: string;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  applies: boolean;
  unanswered?: boolean;
  gateFactKey?: string | null;
};

export function writeRequirementDef(_row: RequirementDefWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeOrgFact(_row: OrgFactWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeObligationInstance(
  _row: ObligationInstanceWrite,
): ComplianceStoreWriteResult {
  return stub();
}

export function writeObligationAssignee(
  _row: ObligationAssigneeWrite,
): ComplianceStoreWriteResult {
  return stub();
}

export function writeFileRecord(_row: FileRecordWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeAttestation(_row: AttestationWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeTrainingRun(_row: TrainingRunWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeReview(_row: ReviewWrite): ComplianceStoreWriteResult {
  return stub();
}

export function writeRequirementApplicability(
  _row: ApplicabilityWrite,
): ComplianceStoreWriteResult {
  return stub();
}
