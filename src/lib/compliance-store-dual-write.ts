/**
 * Best-effort dual-write from locked SOW legacy writers onto the unified
 * register. Never throw — a new-store failure must not fail the primary write.
 */

import {
  gateFactKeyForSowEntry,
  platformRequirementDefs,
  requirementKeyForClientTrainingType,
  requirementKeyForInHiveCourse,
  resolveLockedSowEntry,
  subjectKindForSowEntry,
} from "./compliance-requirement-catalog.ts";
import {
  bestEffortComplianceWrite,
  seedPlatformRequirementDefs,
  writeAttestation,
  writeFileRecord,
  writeObligationAssignee,
  writeObligationInstance,
  writeOrgFact,
  writeRequirementApplicability,
  writeTrainingRun,
  type ComplianceInstanceStatus,
  type ComplianceStoreWriteResult,
  type ComplianceSubjectKind,
} from "./compliance-store.ts";

export type DualWriteObligation = {
  title?: string | null;
  key?: string | null;
};

export type DualWriteInstance = {
  id?: string | null;
  organization_id: string;
  period_key?: string | null;
  due_at?: string | null;
  status?: string | null;
  completed_at?: string | null;
  waive_reason?: string | null;
  assignee_staff_id?: string | null;
  client_id?: string | null;
  event_description?: string | null;
};

export type DualWriteAssignee = {
  staff_id: string;
  staff_name?: string | null;
  staff_role?: string | null;
};

export type DualWriteCompletion = {
  staff_id?: string | null;
  attestation_text_snapshot?: string | null;
  attestation_signed_at?: string | null;
  upload_path?: string | null;
  upload_filename?: string | null;
  completed_at?: string | null;
};

function mapLegacyStatus(status: string | null | undefined): ComplianceInstanceStatus {
  if (status === "completed" || status === "complete") return "complete";
  if (status === "waived") return "waived";
  if (status === "pending" || status === "overdue" || status === "due") return "due";
  return "missing";
}

function subjectForInstance(
  instance: DualWriteInstance,
  fallback: ComplianceSubjectKind,
): { subjectKind: ComplianceSubjectKind; subjectId: string | null } {
  if (instance.client_id) return { subjectKind: "client", subjectId: instance.client_id };
  if (instance.assignee_staff_id) {
    return { subjectKind: "staff", subjectId: instance.assignee_staff_id };
  }
  if (instance.event_description && fallback === "site") {
    return { subjectKind: "site", subjectId: instance.event_description };
  }
  if (fallback === "site" && instance.event_description) {
    return { subjectKind: "site", subjectId: instance.event_description };
  }
  return { subjectKind: fallback, subjectId: null };
}

export async function dualWriteCompanyObligationInstance(
  supabase: unknown,
  ob: DualWriteObligation,
  instance: DualWriteInstance,
  assignees?: DualWriteAssignee[],
): Promise<ComplianceStoreWriteResult> {
  return bestEffortComplianceWrite("obligation_instances", async () => {
    const entry = resolveLockedSowEntry(ob);
    if (!entry) return { written: false, reason: "not_locked_sow" };

    const fallbackKind = subjectKindForSowEntry(entry);
    const { subjectKind, subjectId } = subjectForInstance(instance, fallbackKind);
    if (subjectKind !== "org" && !subjectId) {
      return { written: false, reason: "missing_subject" };
    }

    const status = mapLegacyStatus(instance.status);
    const written = await writeObligationInstance(supabase, {
      organizationId: instance.organization_id,
      requirementKey: entry.key,
      subjectKind,
      subjectId,
      status,
      dueAt: instance.due_at ?? null,
      completedAt: instance.completed_at ?? null,
      waivedAt: status === "waived" ? new Date().toISOString() : null,
      waivedReason: instance.waive_reason ?? null,
      sourceSowCite: entry.citation,
      gateFactKey: gateFactKeyForSowEntry(entry),
      periodKey: instance.period_key ?? null,
    });
    if (!written.written || !written.id || !assignees?.length) return written;

    for (const assignee of assignees) {
      await writeObligationAssignee(supabase, {
        organizationId: instance.organization_id,
        instanceId: written.id,
        staffId: assignee.staff_id,
        staffName: assignee.staff_name ?? null,
        staffRole: assignee.staff_role ?? null,
      });
    }
    return written;
  });
}

export async function dualWriteCompanyObligationCompletion(
  supabase: unknown,
  ob: DualWriteObligation,
  instance: DualWriteInstance,
  completion: DualWriteCompletion,
): Promise<void> {
  await bestEffortComplianceWrite("completions", async () => {
    const entry = resolveLockedSowEntry(ob);
    if (!entry) return { written: false, reason: "not_locked_sow" };

    const fallbackKind = subjectKindForSowEntry(entry);
    const { subjectKind, subjectId } = subjectForInstance(instance, fallbackKind);
    const instanceWrite = await writeObligationInstance(supabase, {
      organizationId: instance.organization_id,
      requirementKey: entry.key,
      subjectKind,
      subjectId,
      status: "complete",
      dueAt: instance.due_at ?? null,
      completedAt: completion.completed_at ?? instance.completed_at ?? new Date().toISOString(),
      sourceSowCite: entry.citation,
      gateFactKey: gateFactKeyForSowEntry(entry),
      periodKey: instance.period_key ?? null,
    });

    let evidenceFileId: string | null = null;
    if (completion.upload_path) {
      const file = await writeFileRecord(supabase, {
        organizationId: instance.organization_id,
        instanceId: instanceWrite.id ?? null,
        subjectKind,
        subjectId,
        requirementKey: entry.key,
        storagePath: completion.upload_path,
        filename: completion.upload_filename ?? null,
        uploadedBy: completion.staff_id ?? null,
      });
      evidenceFileId = file.id ?? null;
      if (evidenceFileId && instanceWrite.id) {
        await writeObligationInstance(supabase, {
          organizationId: instance.organization_id,
          requirementKey: entry.key,
          subjectKind,
          subjectId,
          status: "complete",
          dueAt: instance.due_at ?? null,
          completedAt: completion.completed_at ?? instance.completed_at ?? new Date().toISOString(),
          sourceSowCite: entry.citation,
          gateFactKey: gateFactKeyForSowEntry(entry),
          periodKey: instance.period_key ?? null,
          evidenceFileId,
        });
      }
    }

    if (completion.attestation_signed_at || completion.attestation_text_snapshot) {
      if (completion.staff_id) {
        await writeAttestation(supabase, {
          organizationId: instance.organization_id,
          instanceId: instanceWrite.id ?? null,
          subjectKind,
          subjectId,
          requirementKey: entry.key,
          attestedBy: completion.staff_id,
          attestationTextSnapshot: completion.attestation_text_snapshot ?? null,
        });
      }
    }

    return instanceWrite;
  });
}

export async function dualWriteTrainingCompletion(args: {
  supabase: unknown;
  organizationId: string | null | undefined;
  staffId: string;
  requirementKey: string | null;
  courseKey?: string | null;
  sourceSystem?: "in_hive" | "hive_training" | "external" | "manual_entry";
  completedAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
  attestationText?: string | null;
}): Promise<void> {
  const organizationId = args.organizationId;
  const requirementKey = args.requirementKey;
  if (!organizationId || !requirementKey) return;

  await bestEffortComplianceWrite("training_runs", async () => {
    const run = await writeTrainingRun(args.supabase, {
      organizationId,
      subjectKind: "staff",
      subjectId: args.staffId,
      requirementKey,
      sourceSystem: args.sourceSystem ?? "in_hive",
      courseKey: args.courseKey ?? null,
      completedAt: args.completedAt ?? new Date().toISOString(),
      score: args.score ?? null,
      passed: args.passed ?? true,
    });
    if (args.attestationText) {
      await writeAttestation(args.supabase, {
        organizationId,
        instanceId: run.id ?? null,
        subjectKind: "staff",
        subjectId: args.staffId,
        requirementKey,
        attestedBy: args.staffId,
        attestationTextSnapshot: args.attestationText,
      });
    }
    return run;
  });
}

export async function dualWriteInHiveTrainingCompletion(args: {
  supabase: unknown;
  organizationId: string | null | undefined;
  staffId: string;
  courseId: string;
  completedAt?: string | null;
  score?: number | null;
  passed?: boolean | null;
  attestationText?: string | null;
}): Promise<void> {
  await dualWriteTrainingCompletion({
    ...args,
    requirementKey: requirementKeyForInHiveCourse(args.courseId),
    courseKey: args.courseId,
    sourceSystem: "in_hive",
  });
}

export async function dualWriteClientTrainingCompletion(args: {
  supabase: unknown;
  organizationId: string;
  staffId: string;
  clientId: string;
  trainingType: string;
  completedAt?: string | null;
  attestationText?: string | null;
}): Promise<void> {
  const requirementKey = requirementKeyForClientTrainingType(args.trainingType);
  if (!requirementKey) return;
  await bestEffortComplianceWrite("client_training", async () => {
    const run = await writeTrainingRun(args.supabase, {
      organizationId: args.organizationId,
      subjectKind: "client",
      subjectId: args.clientId,
      requirementKey,
      sourceSystem: "in_hive",
      courseKey: args.trainingType,
      completedAt: args.completedAt ?? new Date().toISOString(),
      passed: true,
    });
    if (args.attestationText) {
      await writeAttestation(args.supabase, {
        organizationId: args.organizationId,
        instanceId: run.id ?? null,
        subjectKind: "client",
        subjectId: args.clientId,
        requirementKey,
        attestedBy: args.staffId,
        attestationTextSnapshot: args.attestationText,
      });
    }
    return run;
  });
}

const NECTAR_SOW_ATTEST_SCOPES = new Set(["requirement_verify", "external_completion"]);

export async function dualWriteNectarAttestation(args: {
  supabase: unknown;
  organizationId: string;
  attestedBy: string;
  scope: string;
  requirementTitle?: string | null;
  requirementKey?: string | null;
  statement?: string | null;
}): Promise<void> {
  if (!NECTAR_SOW_ATTEST_SCOPES.has(args.scope)) return;
  const entry = resolveLockedSowEntry({
    title: args.requirementTitle ?? null,
    key: args.requirementKey ?? null,
  });
  if (!entry) return;

  await bestEffortComplianceWrite("nectar_attestations", () =>
    writeAttestation(args.supabase, {
      organizationId: args.organizationId,
      subjectKind: subjectKindForSowEntry(entry),
      requirementKey: entry.key,
      attestedBy: args.attestedBy,
      attestationTextSnapshot: args.statement ?? null,
    }),
  );
}

export async function dualWriteOrgProfileFacts(args: {
  supabase: unknown;
  organizationId: string;
  recordedBy?: string | null;
  operates_ol_site?: boolean | null;
  uses_volunteers?: boolean | null;
  has_governing_board?: boolean | null;
}): Promise<void> {
  const facts: Array<{ key: string; value: boolean | null | undefined }> = [
    { key: "operates_ol_site", value: args.operates_ol_site },
    { key: "uses_volunteers", value: args.uses_volunteers },
    { key: "has_governing_board", value: args.has_governing_board },
  ];
  for (const fact of facts) {
    if (fact.value == null) continue;
    await bestEffortComplianceWrite(`org_facts.${fact.key}`, () =>
      writeOrgFact(args.supabase, {
        organizationId: args.organizationId,
        subjectKind: "org",
        factKey: fact.key,
        factValue: fact.value,
        source: "recorded",
        recordedBy: args.recordedBy ?? null,
      }),
    );
  }
}

export async function dualWriteRequirementApplicabilityRows(args: {
  supabase: unknown;
  organizationId: string;
  rows: Array<{
    obligationKey: string;
    factKey: string;
    applies: boolean;
    unanswered: boolean;
  }>;
}): Promise<void> {
  for (const row of args.rows) {
    const entry = resolveLockedSowEntry({ key: row.obligationKey });
    if (!entry) continue;
    await bestEffortComplianceWrite(`applicability.${row.obligationKey}`, () =>
      writeRequirementApplicability(args.supabase, {
        organizationId: args.organizationId,
        requirementKey: entry.key,
        subjectKind: subjectKindForSowEntry(entry),
        applies: row.applies,
        unanswered: row.unanswered,
        gateFactKey: row.factKey,
      }),
    );
  }
}

export async function trySeedPlatformRequirementDefs(supabase: unknown): Promise<void> {
  const defs = platformRequirementDefs();
  await bestEffortComplianceWrite("seed_requirement_defs", async () => {
    const result = await seedPlatformRequirementDefs(
      supabase,
      defs.map((row) => ({
        organizationId: null,
        requirementKey: row.requirementKey,
        subjectKind: row.subjectKind,
        layer: row.layer,
        title: row.title,
        sourceSowCite: row.sourceSowCite,
        gateFactKey: row.gateFactKey,
        defaultOn: row.defaultOn,
      })),
    );
    return { written: result.written > 0, reason: `${result.written}/${result.attempted}` };
  });
}

export async function resolveWriterOrganizationId(
  supabase: unknown,
  userId: string,
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data?.organization_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}
