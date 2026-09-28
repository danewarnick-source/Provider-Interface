/**
 * Unified "what qualifications does this staff member currently hold" resolver.
 *
 * Reads across every existing qualification source and returns one canonical
 * Set of keys formatted as `"<kind>:<key>"`, so downstream consumers
 * (staff-prerequisite detector today; scheduling later) do one lookup.
 *
 * Canonical qualification-key namespaces:
 *   external_cert:<cert_type>            Evidence item whose requirement key matches a legacy cert
 *   baseline_training:<requirement_key>  current Evidence item (file on record, not past due)
 *   hive_course:<baseline_key|course_id> hive_training_assignments status='completed', unexpired
 *   client_specific_training:<ref_id>    training_completions topic_kind='person', is_current
 *
 * "must_be_unexpired=false" callers can widen matches by asking for the
 * union set (returned as `all`). "must_be_unexpired=true" callers use
 * `activeOnly`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cellStatus, latestFileForItem } from "@/lib/evidence/status";
import type { EvidenceFileRow, EvidenceItemRow } from "@/lib/evidence/types";

export type QualificationKind =
  | "external_cert"
  | "baseline_training"
  | "hive_course"
  | "client_specific_training";

export type QualificationsSnapshot = {
  activeOnly: string[]; // unexpired only
  all: string[]; // held ever (may be expired)
};

const qkey = (kind: QualificationKind, key: string) => `${kind}:${key}`;

/** Catalog keys that already stand in for the old hardcoded cert types. */
const LEGACY_CERT_FOR_EVIDENCE_KEY: Record<string, string> = {
  cpr_first_aid: "cpr-fa",
  cpr_first_aid_bbp: "cpr-fa",
  abuse_neglect: "abuse-neglect",
  abuse_neglect_exploitation: "abuse-neglect",
};

type EvidenceQualRow = {
  id: string;
  subject_id: string;
  requirement_key: string;
  evidence_type: string;
  expires_on: string | null;
  first_due_on: string | null;
  next_due_on: string | null;
  opted_out_at: string | null;
};

function evidenceOnFile(item: EvidenceQualRow, file: EvidenceFileRow | null): boolean {
  if (!file) return false;
  if (item.evidence_type === "attestation") return !!file.attested_at;
  return !!(file.storage_path || file.filename);
}

/** Current Evidence rows become baseline_training keys. Legacy cert aliases stay so scheduling still matches. */
export async function addEvidenceQualifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  organizationId: string,
  staffIds: string[],
  today: string,
  add: (staffId: string, key: string, active: boolean) => void,
): Promise<void> {
  if (!staffIds.length) return;
  const { data: items } = await supabase
    .from("evidence_items")
    .select(
      "id, subject_id, requirement_key, evidence_type, expires_on, first_due_on, next_due_on, opted_out_at",
    )
    .eq("organization_id", organizationId)
    .eq("subject_type", "staff")
    .in("subject_id", staffIds);
  const rows = (items ?? []) as EvidenceQualRow[];
  if (!rows.length) return;
  const { data: files } = await supabase
    .from("evidence_files")
    .select("id, item_id, storage_path, filename, attested_at, uploaded_at, review_status")
    .in(
      "item_id",
      rows.map((r) => r.id),
    );
  const fileRows = (
    (files ?? []) as Array<Partial<EvidenceFileRow> & { id: string; item_id: string }>
  ).map(
    (f) =>
      ({
        id: f.id,
        organization_id: organizationId,
        item_id: f.item_id,
        storage_path: f.storage_path ?? null,
        filename: f.filename ?? null,
        attested_at: f.attested_at ?? null,
        attested_by: null,
        attestation_text_snapshot: null,
        uploaded_by: null,
        uploaded_at: f.uploaded_at ?? null,
        notes: null,
        review_status: f.review_status ?? null,
      }) satisfies EvidenceFileRow,
  );
  for (const item of rows) {
    if (!item.requirement_key || !item.subject_id || item.opted_out_at) continue;
    const file = latestFileForItem(fileRows, item.id);
    if (!evidenceOnFile(item, file)) continue;
    const active =
      cellStatus({
        item: item as EvidenceItemRow,
        file,
        today,
      }) === "done";
    add(item.subject_id, qkey("baseline_training", item.requirement_key), active);
    const legacy = LEGACY_CERT_FOR_EVIDENCE_KEY[item.requirement_key];
    if (legacy) add(item.subject_id, qkey("external_cert", legacy), active);
  }
}

async function loadQualifications(args: {
  supabase: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  staffId: string;
  organizationId: string;
  at: string; // ISO
}): Promise<QualificationsSnapshot> {
  const { supabase, staffId, organizationId, at } = args;
  const active = new Set<string>();
  const all = new Set<string>();

  const today = at.slice(0, 10);
  await addEvidenceQualifications(
    supabase,
    organizationId,
    [staffId],
    today,
    (_id, key, isActive) => {
      all.add(key);
      if (isActive) active.add(key);
    },
  );

  // hive_training_assignments — completed courses, keyed by baseline_key when present, else course_id
  const { data: assigns } = await supabase
    .from("hive_training_assignments")
    .select("course_id, status, completed_at, expires_at")
    .eq("user_id", staffId);
  const assignRows = (assigns ?? []) as Array<{
    course_id: string;
    status: string;
    completed_at: string | null;
    expires_at: string | null;
  }>;
  const courseIds = Array.from(new Set(assignRows.map((r) => r.course_id).filter(Boolean)));
  const baselineByCourse = new Map<string, string | null>();
  if (courseIds.length) {
    const { data: courses } = await supabase
      .from("hive_training_courses")
      .select("id, baseline_key")
      .in("id", courseIds);
    for (const c of (courses ?? []) as Array<{ id: string; baseline_key: string | null }>) {
      baselineByCourse.set(c.id, c.baseline_key);
    }
  }
  for (const r of assignRows) {
    if (r.status !== "completed") continue;
    const bkey = baselineByCourse.get(r.course_id) ?? null;
    // Register under both course_id and baseline_key when available so rules
    // that reference either identifier resolve.
    const keys = [qkey("hive_course", r.course_id)];
    if (bkey) keys.push(qkey("hive_course", bkey));
    const unexpired = !r.expires_at || r.expires_at > at;
    for (const k of keys) {
      all.add(k);
      if (unexpired) active.add(k);
    }
  }

  // 4. training_completions — client-specific (person topic)
  const { data: comps } = await supabase
    .from("training_completions")
    .select("ref_id, is_current, topic_kind")
    .eq("user_id", staffId)
    .eq("topic_kind", "person");
  for (const c of (comps ?? []) as Array<{
    ref_id: string;
    is_current: boolean | null;
    topic_kind: string;
  }>) {
    if (!c.ref_id) continue;
    const key = qkey("client_specific_training", c.ref_id);
    all.add(key);
    if (c.is_current) active.add(key);
  }

  return { activeOnly: Array.from(active).sort(), all: Array.from(all).sort() };
}

export const getStaffQualifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organizationId: z.string().uuid(),
        staffId: z.string().uuid(),
        at: z.string().optional(), // ISO
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<QualificationsSnapshot> => {
    if (!context.supabase || !context.userId) return { activeOnly: [], all: [] };
    return await loadQualifications({
      supabase: context.supabase,
      staffId: data.staffId,
      organizationId: data.organizationId,
      at: data.at ?? new Date().toISOString(),
    });
  });

// Server-only helper (safe to reuse from other server fns in the same request).
export async function resolveStaffQualifications(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  args: { organizationId: string; staffId: string; at: string },
): Promise<QualificationsSnapshot> {
  return loadQualifications({ supabase, ...args });
}

export function qualificationKey(kind: QualificationKind, key: string) {
  return qkey(kind, key);
}
