/**
 * Phase 2 compliance + training core-store writers.
 *
 * Production reads stay on company_obligations* / nectar_* / training_*.
 * These writers upsert the nine unified tables. Callers must wrap them in
 * bestEffortComplianceWrite so a new-store failure never fails the legacy write.
 */

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
  written: boolean;
  id?: string;
  reason?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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
  recordedBy?: string | null;
};

export type ObligationInstanceWrite = {
  organizationId: string;
  requirementKey: string;
  subjectKind: ComplianceSubjectKind;
  subjectId?: string | null;
  status: ComplianceInstanceStatus;
  dueAt?: string | null;
  completedAt?: string | null;
  waivedAt?: string | null;
  waivedReason?: string | null;
  sourceSowCite?: string | null;
  gateFactKey?: string | null;
  periodKey?: string | null;
  evidenceFileId?: string | null;
  requirementDefId?: string | null;
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
  uploadedBy?: string | null;
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
  startedAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
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

function asClient(supabase: unknown): AnySupabase {
  return supabase as AnySupabase;
}

function fail(reason: string): ComplianceStoreWriteResult {
  return { written: false, reason };
}

function ok(id?: string | null): ComplianceStoreWriteResult {
  return id ? { written: true, id } : { written: true };
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  return String(err);
}

export async function bestEffortComplianceWrite(
  label: string,
  work: () => Promise<ComplianceStoreWriteResult>,
): Promise<ComplianceStoreWriteResult> {
  try {
    return await work();
  } catch (err) {
    console.warn(`[compliance-store] ${label} failed`, errorMessage(err));
    return fail(errorMessage(err));
  }
}

async function lookupPlatformDefId(
  supabase: AnySupabase,
  requirementKey: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("requirement_defs")
    .select("id")
    .is("organization_id", null)
    .eq("requirement_key", requirementKey)
    .maybeSingle();
  if (error) return null;
  return (data?.id as string | undefined) ?? null;
}

export async function writeRequirementDef(
  supabase: unknown,
  row: RequirementDefWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const payload = {
    organization_id: row.organizationId,
    requirement_key: row.requirementKey,
    subject_kind: row.subjectKind,
    layer: row.layer,
    title: row.title ?? "",
    source_sow_cite: row.sourceSowCite ?? null,
    gate_fact_key: row.gateFactKey ?? null,
    default_on: row.defaultOn ?? true,
  };
  let query = sb.from("requirement_defs").select("id").eq("requirement_key", row.requirementKey);
  query = row.organizationId
    ? query.eq("organization_id", row.organizationId)
    : query.is("organization_id", null);
  const { data: existing, error: lookErr } = await query.maybeSingle();
  if (lookErr) return fail(lookErr.message);

  if (existing?.id) {
    const { data, error } = await sb
      .from("requirement_defs")
      .update({
        subject_kind: payload.subject_kind,
        layer: payload.layer,
        title: payload.title,
        source_sow_cite: payload.source_sow_cite,
        gate_fact_key: payload.gate_fact_key,
        default_on: payload.default_on,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data?.id ?? existing.id);
  }

  const { data, error } = await sb
    .from("requirement_defs")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeOrgFact(
  supabase: unknown,
  row: OrgFactWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const payload = {
    organization_id: row.organizationId,
    subject_kind: row.subjectKind,
    subject_id: row.subjectId ?? null,
    fact_key: row.factKey,
    fact_value: row.factValue === undefined ? true : row.factValue,
    source: row.source ?? "recorded",
    recorded_by: row.recordedBy ?? null,
    recorded_at: new Date().toISOString(),
  };
  let query = sb
    .from("org_facts")
    .select("id")
    .eq("organization_id", row.organizationId)
    .eq("subject_kind", row.subjectKind)
    .eq("fact_key", row.factKey);
  query = row.subjectId ? query.eq("subject_id", row.subjectId) : query.is("subject_id", null);
  const { data: existing, error: lookErr } = await query.maybeSingle();
  if (lookErr) return fail(lookErr.message);

  if (existing?.id) {
    const { data, error } = await sb
      .from("org_facts")
      .update({
        fact_value: payload.fact_value,
        source: payload.source,
        recorded_by: payload.recorded_by,
        recorded_at: payload.recorded_at,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data?.id ?? existing.id);
  }

  const { data, error } = await sb.from("org_facts").insert(payload).select("id").maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeObligationInstance(
  supabase: unknown,
  row: ObligationInstanceWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const defId = row.requirementDefId ?? (await lookupPlatformDefId(sb, row.requirementKey));
  const payload = {
    organization_id: row.organizationId,
    requirement_def_id: defId,
    requirement_key: row.requirementKey,
    subject_kind: row.subjectKind,
    subject_id: row.subjectId ?? null,
    status: row.status,
    due_at: row.dueAt ?? null,
    completed_at: row.completedAt ?? null,
    waived_at: row.waivedAt ?? null,
    waived_reason: row.waivedReason ?? null,
    period_key: row.periodKey ?? null,
    source_sow_cite: row.sourceSowCite ?? null,
    gate_fact_key: row.gateFactKey ?? null,
    evidence_file_id: row.evidenceFileId ?? null,
  };
  let query = sb
    .from("obligation_instances")
    .select("id")
    .eq("organization_id", row.organizationId)
    .eq("requirement_key", row.requirementKey)
    .eq("subject_kind", row.subjectKind);
  query = row.subjectId ? query.eq("subject_id", row.subjectId) : query.is("subject_id", null);
  query = row.periodKey ? query.eq("period_key", row.periodKey) : query.is("period_key", null);
  const { data: existing, error: lookErr } = await query.maybeSingle();
  if (lookErr) return fail(lookErr.message);

  if (existing?.id) {
    const { data, error } = await sb
      .from("obligation_instances")
      .update({
        requirement_def_id: payload.requirement_def_id,
        status: payload.status,
        due_at: payload.due_at,
        completed_at: payload.completed_at,
        waived_at: payload.waived_at,
        waived_reason: payload.waived_reason,
        source_sow_cite: payload.source_sow_cite,
        gate_fact_key: payload.gate_fact_key,
        evidence_file_id: payload.evidence_file_id,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data?.id ?? existing.id);
  }

  const { data, error } = await sb
    .from("obligation_instances")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeObligationAssignee(
  supabase: unknown,
  row: ObligationAssigneeWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const { data, error } = await sb
    .from("obligation_instance_assignees")
    .upsert(
      {
        organization_id: row.organizationId,
        instance_id: row.instanceId,
        staff_id: row.staffId,
        staff_name: row.staffName ?? null,
        staff_role: row.staffRole ?? null,
      },
      { onConflict: "instance_id,staff_id", ignoreDuplicates: false },
    )
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeFileRecord(
  supabase: unknown,
  row: FileRecordWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const { data: existing, error: lookErr } = await sb
    .from("file_records")
    .select("id")
    .eq("organization_id", row.organizationId)
    .eq("storage_path", row.storagePath)
    .maybeSingle();
  if (lookErr) return fail(lookErr.message);
  if (existing?.id) return ok(existing.id);

  const { data, error } = await sb
    .from("file_records")
    .insert({
      organization_id: row.organizationId,
      instance_id: row.instanceId ?? null,
      subject_kind: row.subjectKind,
      subject_id: row.subjectId ?? null,
      requirement_key: row.requirementKey ?? null,
      storage_path: row.storagePath,
      filename: row.filename ?? null,
      uploaded_by: row.uploadedBy ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeAttestation(
  supabase: unknown,
  row: AttestationWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const { data, error } = await sb
    .from("attestations")
    .insert({
      organization_id: row.organizationId,
      instance_id: row.instanceId ?? null,
      subject_kind: row.subjectKind,
      subject_id: row.subjectId ?? null,
      requirement_key: row.requirementKey ?? null,
      attested_by: row.attestedBy,
      attestation_text_snapshot: row.attestationTextSnapshot ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data?.id);
}

export async function writeTrainingRun(
  supabase: unknown,
  row: TrainingRunWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const payload = {
    organization_id: row.organizationId,
    instance_id: row.instanceId ?? null,
    subject_kind: row.subjectKind ?? "staff",
    subject_id: row.subjectId,
    requirement_key: row.requirementKey ?? null,
    source_system: row.sourceSystem ?? "unwired",
    course_key: row.courseKey ?? null,
    started_at: row.startedAt ?? null,
    completed_at: row.completedAt ?? null,
    score: row.score ?? null,
    passed: row.passed ?? null,
  };

  let query = sb
    .from("training_runs")
    .select("id")
    .eq("organization_id", row.organizationId)
    .eq("subject_id", row.subjectId);
  if (row.requirementKey) query = query.eq("requirement_key", row.requirementKey);
  if (row.courseKey) query = query.eq("course_key", row.courseKey);
  if (row.completedAt) query = query.eq("completed_at", row.completedAt);
  const { data: existing, error: lookErr } = await query.maybeSingle();
  if (lookErr) return fail(lookErr.message);
  if (existing?.id) {
    const { data, error } = await sb
      .from("training_runs")
      .update({
        instance_id: payload.instance_id,
        source_system: payload.source_system,
        score: payload.score,
        passed: payload.passed,
        completed_at: payload.completed_at,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data?.id ?? existing.id);
  }

  const { data, error } = await sb.from("training_runs").insert(payload).select("id").maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function writeReview(
  supabase: unknown,
  row: ReviewWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const { data, error } = await sb
    .from("reviews")
    .insert({
      organization_id: row.organizationId,
      instance_id: row.instanceId ?? null,
      subject_kind: row.subjectKind,
      subject_id: row.subjectId ?? null,
      requirement_key: row.requirementKey ?? null,
      review_kind: row.reviewKind ?? "human",
      notes: row.notes ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message);
  return ok(data?.id);
}

export async function writeRequirementApplicability(
  supabase: unknown,
  row: ApplicabilityWrite,
): Promise<ComplianceStoreWriteResult> {
  const sb = asClient(supabase);
  const payload = {
    organization_id: row.organizationId,
    requirement_key: row.requirementKey,
    subject_kind: row.subjectKind,
    subject_id: row.subjectId ?? null,
    applies: row.applies,
    unanswered: row.unanswered ?? false,
    gate_fact_key: row.gateFactKey ?? null,
    source: "computed",
    computed_at: new Date().toISOString(),
  };
  let query = sb
    .from("requirement_applicability")
    .select("id")
    .eq("organization_id", row.organizationId)
    .eq("requirement_key", row.requirementKey)
    .eq("subject_kind", row.subjectKind);
  query = row.subjectId ? query.eq("subject_id", row.subjectId) : query.is("subject_id", null);
  const { data: existing, error: lookErr } = await query.maybeSingle();
  if (lookErr) return fail(lookErr.message);

  if (existing?.id) {
    const { data, error } = await sb
      .from("requirement_applicability")
      .update({
        applies: payload.applies,
        unanswered: payload.unanswered,
        gate_fact_key: payload.gate_fact_key,
        computed_at: payload.computed_at,
      })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data?.id ?? existing.id);
  }

  const { data, error } = await sb
    .from("requirement_applicability")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "23505") return { written: true };
    return fail(error.message);
  }
  return ok(data?.id);
}

export async function seedPlatformRequirementDefs(
  supabase: unknown,
  rows: RequirementDefWrite[],
): Promise<{ attempted: number; written: number }> {
  let written = 0;
  for (const row of rows) {
    const result = await bestEffortComplianceWrite(`seed ${row.requirementKey}`, () =>
      writeRequirementDef(supabase, { ...row, organizationId: null }),
    );
    if (result.written) written += 1;
  }
  return { attempted: rows.length, written };
}
