/**
 * Evidence Phase 1 persistence.
 * Writes only evidence_items, evidence_files, and evidence_templates.
 * Does not read or write organizations.feature_config.
 * Does not write requirement_defs or company_obligations.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { hostHomeDualLinkPeerKey, packByKey, requirementByKey } from "./evidence/catalog.ts";
import {
  companyEvidencePerson,
  loadEvidenceClientPeople,
  mapEmployeeRowsToPeople,
  type EvidenceEmployeeRow,
} from "./evidence/people.ts";
import {
  applyDueDraft,
  cadenceFromDue,
  defaultDueDraft,
  dueDefaultForRequirement,
  parseIsoDate,
  type EvidenceDueDraft,
} from "./evidence/due.ts";
import { cellStatus, latestFileForItem } from "./evidence/status.ts";
import {
  EVIDENCE_CADENCES,
  EVIDENCE_PUSH_BODY,
  EVIDENCE_PUSH_LINK,
  EVIDENCE_PUSH_TITLE,
  EVIDENCE_SEND_MESSAGE_UNAVAILABLE,
  EVIDENCE_STORAGE_UNAVAILABLE,
  FIRST_DUE_RULES,
  type EvidenceCellStatus,
  type EvidenceFileRow,
  type EvidenceGridCell,
  type EvidenceGridColumn,
  type EvidenceItemRow,
  type EvidencePerson,
  type EvidenceSubject,
  type EvidenceTemplateRow,
  type EvidenceType,
  type FirstDueRule,
  type RenewYears,
} from "./evidence/types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const SubjectEnum = z.enum(["staff", "client", "company"]);
const TypeEnum = z.enum(["upload", "attestation"]);
const CadenceEnum = z.enum(EVIDENCE_CADENCES);

type StoreV1 = {
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
  templates: EvidenceTemplateRow[];
};

function emptyStore(): StoreV1 {
  return { items: [], files: [], templates: [] };
}

function tableMissing(message: string | undefined): boolean {
  return /does not exist|schema cache|evidence_items|evidence_files|evidence_templates/i.test(
    message ?? "",
  );
}

function sendMessageColumnMissing(message: string | undefined): boolean {
  return (
    /send_message/i.test(message ?? "") && /column|schema cache|does not exist/i.test(message ?? "")
  );
}

function dueColumnMissing(message: string | undefined): boolean {
  return (
    /first_due_rule|first_due_on|document_date|next_due_on|renew_years/i.test(message ?? "") &&
    /column|schema cache|does not exist/i.test(message ?? "")
  );
}

const ITEM_SELECT_BASE =
  "id, organization_id, subject_type, subject_id, requirement_key, title, evidence_type, attestation_text, cadence, sow_cite, suggested, sent_to_staff, visible_to_staff_id, dual_link_key, dual_link_peer_id, expires_on, created_at, updated_at";

const ITEM_SELECT_WITH_MESSAGE = `${ITEM_SELECT_BASE.replace(", created_at, updated_at", "")}, send_message, created_at, updated_at`;

const ITEM_SELECT_WITH_DUE = `${ITEM_SELECT_BASE.replace(", created_at, updated_at", "")}, send_message, first_due_rule, first_due_on, document_date, next_due_on, renew_years, created_at, updated_at`;

const FirstDueEnum = z.enum(FIRST_DUE_RULES);
const DueDraftSchema = z.object({
  firstDueRule: FirstDueEnum,
  firstDueOn: z.string().nullable(),
  renewYears: z.union([z.literal(1), z.literal(2), z.null()]),
  nextDueMode: z.enum(["years", "set_date", "none"]),
  nextDueOn: z.string().nullable(),
});

function asFirstDueRule(value: unknown): FirstDueRule | null {
  return FIRST_DUE_RULES.includes(value as FirstDueRule) ? (value as FirstDueRule) : null;
}

function asRenewYears(value: unknown): RenewYears {
  return value === 1 || value === 2 ? value : null;
}

function normalizeItem(row: EvidenceItemRow | Record<string, unknown>): EvidenceItemRow {
  const raw = row as EvidenceItemRow & {
    send_message?: unknown;
    first_due_rule?: unknown;
    first_due_on?: unknown;
    document_date?: unknown;
    next_due_on?: unknown;
    renew_years?: unknown;
  };
  return {
    ...(raw as EvidenceItemRow),
    send_message: typeof raw.send_message === "string" ? raw.send_message : null,
    first_due_rule: asFirstDueRule(raw.first_due_rule),
    first_due_on: parseIsoDate(typeof raw.first_due_on === "string" ? raw.first_due_on : null),
    document_date: parseIsoDate(typeof raw.document_date === "string" ? raw.document_date : null),
    next_due_on: parseIsoDate(typeof raw.next_due_on === "string" ? raw.next_due_on : null),
    renew_years: asRenewYears(raw.renew_years),
  };
}

function coreItemPayload(row: EvidenceItemRow): Record<string, unknown> {
  return {
    id: row.id,
    organization_id: row.organization_id,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    requirement_key: row.requirement_key,
    title: row.title,
    evidence_type: row.evidence_type,
    attestation_text: row.attestation_text,
    cadence: row.cadence,
    sow_cite: row.sow_cite,
    suggested: row.suggested,
    sent_to_staff: row.sent_to_staff,
    visible_to_staff_id: row.visible_to_staff_id,
    dual_link_key: row.dual_link_key,
    dual_link_peer_id: row.dual_link_peer_id,
    expires_on: row.expires_on,
    updated_at: row.updated_at,
  };
}

function dueItemPayload(row: EvidenceItemRow): Record<string, unknown> {
  return {
    first_due_rule: row.first_due_rule,
    first_due_on: row.first_due_on,
    document_date: row.document_date,
    next_due_on: row.next_due_on,
    renew_years: row.renew_years,
  };
}

function mapEvidenceDbError(message: string | undefined): string {
  const text = message ?? "";
  if (/feature_config/i.test(text) || tableMissing(text)) {
    return EVIDENCE_STORAGE_UNAVAILABLE;
  }
  return text || EVIDENCE_STORAGE_UNAVAILABLE;
}

function requireTables(viaTables: boolean): void {
  if (!viaTables) throw new Error(EVIDENCE_STORAGE_UNAVAILABLE);
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function loadAll(
  sb: AnySupabase,
  organizationId: string,
): Promise<{ store: StoreV1; viaTables: boolean; hasSendMessage: boolean; hasDue: boolean }> {
  let hasSendMessage = true;
  let hasDue = true;
  let items: EvidenceItemRow[] | null = null;
  const first = await sb
    .from("evidence_items")
    .select(ITEM_SELECT_WITH_DUE)
    .eq("organization_id", organizationId);
  if (first.error) {
    if (tableMissing(first.error.message) && !sendMessageColumnMissing(first.error.message) && !dueColumnMissing(first.error.message)) {
      return { store: emptyStore(), viaTables: false, hasSendMessage: false, hasDue: false };
    }
    hasDue = !dueColumnMissing(first.error.message);
    hasSendMessage = !sendMessageColumnMissing(first.error.message);
    const fallbackSelect = hasSendMessage ? ITEM_SELECT_WITH_MESSAGE : ITEM_SELECT_BASE;
    const second = await sb
      .from("evidence_items")
      .select(fallbackSelect)
      .eq("organization_id", organizationId);
    if (second.error) {
      if (tableMissing(second.error.message)) {
        return { store: emptyStore(), viaTables: false, hasSendMessage: false, hasDue: false };
      }
      if (sendMessageColumnMissing(second.error.message)) {
        hasSendMessage = false;
        const third = await sb
          .from("evidence_items")
          .select(ITEM_SELECT_BASE)
          .eq("organization_id", organizationId);
        if (third.error) {
          if (tableMissing(third.error.message)) {
            return { store: emptyStore(), viaTables: false, hasSendMessage: false, hasDue: false };
          }
          throw new Error(mapEvidenceDbError(third.error.message));
        }
        items = ((third.data ?? []) as EvidenceItemRow[]).map(normalizeItem);
      } else {
        throw new Error(mapEvidenceDbError(second.error.message));
      }
    } else {
      items = ((second.data ?? []) as EvidenceItemRow[]).map(normalizeItem);
    }
  } else {
    items = ((first.data ?? []) as EvidenceItemRow[]).map(normalizeItem);
  }
  const { data: files, error: fileErr } = await sb
    .from("evidence_files")
    .select(
      "id, organization_id, item_id, storage_path, filename, attested_at, attested_by, attestation_text_snapshot, uploaded_by, uploaded_at, notes",
    )
    .eq("organization_id", organizationId);
  if (fileErr) {
    if (tableMissing(fileErr.message)) {
      return { store: emptyStore(), viaTables: false, hasSendMessage: false, hasDue: false };
    }
    throw new Error(mapEvidenceDbError(fileErr.message));
  }
  const { data: templates, error: tplErr } = await sb
    .from("evidence_templates")
    .select("id, organization_id, name, subject_type, pack_keys, requirement_keys, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (tplErr) {
    if (tableMissing(tplErr.message)) {
      return {
        viaTables: true,
        hasSendMessage,
        hasDue,
        store: {
          items: items ?? [],
          files: (files ?? []) as EvidenceFileRow[],
          templates: [],
        },
      };
    }
    throw new Error(mapEvidenceDbError(tplErr.message));
  }
  return {
    viaTables: true,
    hasSendMessage,
    hasDue,
    store: {
      items: items ?? [],
      files: (files ?? []) as EvidenceFileRow[],
      templates: (templates ?? []) as EvidenceTemplateRow[],
    },
  };
}

async function insertItem(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  row: EvidenceItemRow,
): Promise<void> {
  requireTables(viaTables);
  {
    const full = { ...coreItemPayload(row), ...dueItemPayload(row) };
    const first = await sb.from("evidence_items").upsert(full, {
      onConflict: "organization_id,subject_type,subject_id,requirement_key",
    });
    if (!first.error) return;
    if (!dueColumnMissing(first.error.message)) {
      throw new Error(mapEvidenceDbError(first.error.message));
    }
    const retry = await sb.from("evidence_items").upsert(coreItemPayload(row), {
      onConflict: "organization_id,subject_type,subject_id,requirement_key",
    });
    if (retry.error) throw new Error(mapEvidenceDbError(retry.error.message));
  }
}

async function patchItem(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  itemId: string,
  patch: Partial<EvidenceItemRow>,
): Promise<EvidenceItemRow | null> {
  requireTables(viaTables);
  const payload = { ...patch, updated_at: nowIso() };
  const first = await sb
    .from("evidence_items")
    .update(payload)
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .select(ITEM_SELECT_BASE)
    .maybeSingle();
  if (!first.error) {
    return first.data ? normalizeItem(first.data as EvidenceItemRow) : null;
  }
  if (!dueColumnMissing(first.error.message)) {
    throw new Error(mapEvidenceDbError(first.error.message));
  }
  const slim = { ...payload } as Record<string, unknown>;
  delete slim.first_due_rule;
  delete slim.first_due_on;
  delete slim.document_date;
  delete slim.next_due_on;
  delete slim.renew_years;
  const retry = await sb
    .from("evidence_items")
    .update(slim)
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .select(ITEM_SELECT_BASE)
    .maybeSingle();
  if (retry.error) throw new Error(mapEvidenceDbError(retry.error.message));
  return retry.data ? normalizeItem(retry.data as EvidenceItemRow) : null;
}

async function deleteItem(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  itemId: string,
): Promise<void> {
  requireTables(viaTables);
  const { error } = await sb
    .from("evidence_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", itemId);
  if (error) throw new Error(mapEvidenceDbError(error.message));
}

async function insertFileRow(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  row: EvidenceFileRow,
): Promise<void> {
  requireTables(viaTables);
  const { error } = await sb.from("evidence_files").insert(row);
  if (error) throw new Error(mapEvidenceDbError(error.message));
}

async function listStaffPeople(
  sb: AnySupabase,
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  try {
    const { data: members, error } = await sb
      .from("organization_members")
      .select("user_id, role, job_title, active")
      .eq("organization_id", organizationId);
    if (error) return { people: [], error: error.message };
    const rows = (members ?? []) as Array<{
      user_id: string;
      role: string | null;
      job_title: string | null;
      active: boolean | null;
    }>;
    const ids = rows.map((m) => m.user_id).filter((id) => typeof id === "string");
    if (ids.length === 0) return { people: [], error: null };
    const withHire = await sb
      .from("profiles")
      .select(
        "id, full_name, first_name, last_name, account_status, is_active, hire_date, start_date",
      )
      .in("id", ids);
    const full = withHire.error
      ? await sb
          .from("profiles")
          .select("id, full_name, first_name, last_name, account_status, is_active")
          .in("id", ids)
      : withHire;
    const slim = full.error
      ? await sb.from("profiles").select("id, full_name, account_status, is_active").in("id", ids)
      : full;
    if (slim.error) {
      return {
        people: [],
        error: slim.error.message || full.error?.message || "Could not load employees.",
      };
    }
    const profMap = new Map(
      (
        (slim.data ?? []) as Array<{
          id: string;
          full_name: string | null;
          first_name?: string | null;
          last_name?: string | null;
          account_status: string | null;
          is_active: boolean | null;
          hire_date?: string | null;
          start_date?: string | null;
        }>
      ).map((p) => [p.id, p]),
    );
    const joined: EvidenceEmployeeRow[] = rows.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      job_title: m.job_title,
      active: m.active !== false,
      profile: profMap.get(m.user_id) ?? null,
    }));
    return { people: mapEmployeeRowsToPeople(joined), error: null };
  } catch (e) {
    return {
      people: [],
      error: e instanceof Error ? e.message : "Could not load employees.",
    };
  }
}

async function listClientPeople(
  sb: AnySupabase,
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  return loadEvidenceClientPeople((columns) =>
    sb
      .from("clients")
      .select(columns)
      .eq("organization_id", organizationId)
      .order("last_name", { ascending: true }),
  );
}

function companyNameFromOrgRow(
  org: {
    name?: string | null;
    legal_name?: string | null;
    dba_name?: string | null;
  } | null,
): string {
  const dba = (org?.dba_name ?? "").trim();
  const legal = (org?.legal_name ?? "").trim();
  const name = (org?.name ?? "").trim();
  return dba || legal || name || "Company";
}

function buildItemFromKey(args: {
  organizationId: string;
  subjectType: EvidenceSubject;
  subjectId: string;
  requirementKey: string;
  suggested: boolean;
  custom?: {
    title?: string;
    evidenceType?: EvidenceType;
    attestationText?: string | null;
    cadence?: EvidenceItemRow["cadence"];
    sowCite?: string | null;
    due?: EvidenceDueDraft;
    hireDate?: string | null;
    documentDate?: string | null;
  };
}): EvidenceItemRow {
  const def = requirementByKey(args.requirementKey);
  const now = nowIso();
  const due =
    args.custom?.due ??
    defaultDueDraft(
      args.subjectType,
      def?.dueDefault ??
        dueDefaultForRequirement({
          key: args.requirementKey,
          subject: args.subjectType,
          cadence: args.custom?.cadence ?? def?.cadence,
        }),
    );
  const computed = applyDueDraft({
    draft: due,
    hireDate: args.custom?.hireDate ?? null,
    documentDate: args.custom?.documentDate ?? null,
    hasFile: false,
  });
  return {
    id: newId(),
    organization_id: args.organizationId,
    subject_type: args.subjectType,
    subject_id: args.subjectId,
    requirement_key: args.requirementKey,
    title: args.custom?.title?.trim() || def?.title || args.requirementKey,
    evidence_type: args.custom?.evidenceType ?? def?.evidenceType ?? "upload",
    attestation_text: args.custom?.attestationText ?? def?.attestationText ?? null,
    cadence: args.custom?.cadence ?? cadenceFromDue(computed.renew_years),
    sow_cite: args.custom?.sowCite ?? def?.sowCite ?? null,
    suggested: args.suggested,
    sent_to_staff: false,
    visible_to_staff_id: null,
    send_message: null,
    dual_link_key: def?.dualLink ?? null,
    dual_link_peer_id: null,
    expires_on: computed.expires_on,
    first_due_rule: computed.first_due_rule,
    first_due_on: computed.first_due_on,
    document_date: computed.document_date,
    next_due_on: computed.next_due_on,
    renew_years: computed.renew_years,
    created_at: now,
    updated_at: now,
  };
}

async function notifyStaffNoPhi(
  sb: AnySupabase,
  organizationId: string,
  staffId: string,
): Promise<void> {
  try {
    await sb.from("notifications").insert({
      organization_id: organizationId,
      recipient_user_id: staffId,
      type: "evidence_assigned",
      urgency: "normal",
      title: EVIDENCE_PUSH_TITLE,
      body: EVIDENCE_PUSH_BODY,
      link_to: EVIDENCE_PUSH_LINK,
      related_type: "evidence_item",
    });
  } catch {
    /* never block assign on notification */
  }
}

export type EvidenceBoard = {
  viaTables: boolean;
  subject: EvidenceSubject;
  people: EvidencePerson[];
  columns: EvidenceGridColumn[];
  cells: EvidenceGridCell[];
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
  templates: EvidenceTemplateRow[];
  staffPicker: EvidencePerson[];
  orgItemCount: number;
  peopleError: string | null;
};

function boardFromStore(args: {
  viaTables: boolean;
  subject: EvidenceSubject;
  people: EvidencePerson[];
  store: StoreV1;
  staffPicker: EvidencePerson[];
  today: string;
  peopleError?: string | null;
}): EvidenceBoard {
  const items = args.store.items.filter((i) => i.subject_type === args.subject);
  const colMap = new Map<string, EvidenceGridColumn>();
  for (const row of items) {
    if (!colMap.has(row.requirement_key)) {
      colMap.set(row.requirement_key, {
        requirementKey: row.requirement_key,
        label: row.title,
        sowCite: row.sow_cite,
      });
    }
  }
  const columns = [...colMap.values()];
  const cells: EvidenceGridCell[] = [];
  for (const person of args.people) {
    for (const col of columns) {
      const found = items.find(
        (i) => i.subject_id === person.id && i.requirement_key === col.requirementKey,
      );
      const file = found ? latestFileForItem(args.store.files, found.id) : null;
      cells.push({
        subjectId: person.id,
        requirementKey: col.requirementKey,
        itemId: found?.id ?? null,
        status: cellStatus({ item: found ?? null, file, today: args.today }),
        expiresOn: found?.next_due_on ?? found?.first_due_on ?? found?.expires_on ?? null,
      });
    }
  }
  return {
    viaTables: args.viaTables,
    subject: args.subject,
    people: args.people,
    columns,
    cells,
    items,
    files: args.store.files.filter((f) => items.some((i) => i.id === f.item_id)),
    templates: args.store.templates.filter((t) => t.subject_type === args.subject),
    staffPicker: args.staffPicker,
    orgItemCount: args.store.items.length,
    peopleError: args.peopleError ?? null,
  };
}

export const loadEvidenceBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subject: SubjectEnum,
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<EvidenceBoard> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return boardFromStore({
        viaTables: false,
        subject: data.subject,
        people: [],
        store: emptyStore(),
        staffPicker: [],
        today: todayStamp(),
      });
    }
    await requireOrgMembership(supabase, userId, data.organizationId, "employee");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const staffListed = await listStaffPeople(sb, data.organizationId);
    const staff = staffListed.people;
    let people: EvidencePerson[] = staff;
    let peopleError: string | null = data.subject === "staff" ? staffListed.error : null;
    if (data.subject === "client") {
      const listed = await listClientPeople(sb, data.organizationId);
      people = listed.people;
      peopleError = listed.error;
    }
    if (data.subject === "company") {
      try {
        const { data: org } = await sb
          .from("organizations")
          .select("name, legal_name, dba_name")
          .eq("id", data.organizationId)
          .maybeSingle();
        people = [companyEvidencePerson(data.organizationId, companyNameFromOrgRow(org ?? null))];
        peopleError = null;
      } catch {
        people = [companyEvidencePerson(data.organizationId, "Company")];
        peopleError = null;
      }
    }
    return boardFromStore({
      viaTables,
      subject: data.subject,
      people,
      store,
      staffPicker: staff,
      today: todayStamp(),
      peopleError,
    });
  });

export const applyEvidenceRequirements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        requirementKeys: z.array(z.string().min(1)).min(1),
        suggestedKeys: z.array(z.string()).optional(),
        packKeys: z.array(z.string()).optional(),
        typeOverrides: z.record(z.string(), TypeEnum).optional(),
        dueOverrides: z.record(z.string(), DueDraftSchema).optional(),
        dualLinkClientId: z.string().uuid().nullable().optional(),
        dualLinkStaffId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, count: 0 };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const staff =
      data.subjectType === "staff"
        ? (await listStaffPeople(sb, data.organizationId)).people
        : [];
    const suggested = new Set(data.suggestedKeys ?? []);
    let count = 0;
    const created: EvidenceItemRow[] = [];

    for (const subjectId of data.subjectIds) {
      for (const key of data.requirementKeys) {
        const exists = store.items.find(
          (i) =>
            i.subject_type === data.subjectType &&
            i.subject_id === subjectId &&
            i.requirement_key === key,
        );
        if (exists) continue;
        const overrideType = data.typeOverrides?.[key];
        const def = requirementByKey(key);
        const evidenceType = overrideType ?? def?.evidenceType ?? "upload";
        const person = staff.find((p) => p.id === subjectId);
        const hireDate = data.subjectType === "staff" ? (person?.hire_date ?? null) : null;
        const row = buildItemFromKey({
          organizationId: data.organizationId,
          subjectType: data.subjectType,
          subjectId,
          requirementKey: key,
          suggested: suggested.has(key),
          custom: {
            evidenceType,
            attestationText:
              evidenceType === "attestation"
                ? def?.attestationText || `I attest that ${def?.title ?? key} is complete.`
                : null,
            due: data.dueOverrides?.[key],
            hireDate,
          },
        });
        await insertItem(sb, viaTables, data.organizationId, row);
        created.push(row);
        count += 1;
      }
    }

    const hhsStaff = created.find((r) => r.requirement_key === "host_home_cert");
    const hhsClient = created.find((r) => r.requirement_key === "host_home_cert_client");
    if (hhsStaff && data.dualLinkClientId) {
      let peer = store.items.find(
        (i) =>
          i.subject_type === "client" &&
          i.subject_id === data.dualLinkClientId &&
          i.requirement_key === "host_home_cert_client",
      );
      if (!peer) {
        peer = buildItemFromKey({
          organizationId: data.organizationId,
          subjectType: "client",
          subjectId: data.dualLinkClientId,
          requirementKey: "host_home_cert_client",
          suggested: true,
        });
        await insertItem(sb, viaTables, data.organizationId, peer);
        count += 1;
      }
      await patchItem(sb, viaTables, data.organizationId, hhsStaff.id, {
        dual_link_peer_id: peer.id,
        dual_link_key: "host_home_cert",
      });
      await patchItem(sb, viaTables, data.organizationId, peer.id, {
        dual_link_peer_id: hhsStaff.id,
        dual_link_key: "host_home_cert",
      });
    } else if (hhsClient && data.dualLinkStaffId) {
      let peer = store.items.find(
        (i) =>
          i.subject_type === "staff" &&
          i.subject_id === data.dualLinkStaffId &&
          i.requirement_key === "host_home_cert",
      );
      if (!peer) {
        peer = buildItemFromKey({
          organizationId: data.organizationId,
          subjectType: "staff",
          subjectId: data.dualLinkStaffId,
          requirementKey: "host_home_cert",
          suggested: true,
        });
        await insertItem(sb, viaTables, data.organizationId, peer);
        count += 1;
      }
      await patchItem(sb, viaTables, data.organizationId, hhsClient.id, {
        dual_link_peer_id: peer.id,
        dual_link_key: "host_home_cert",
      });
      await patchItem(sb, viaTables, data.organizationId, peer.id, {
        dual_link_peer_id: hhsClient.id,
        dual_link_key: "host_home_cert",
      });
    }

    void data.packKeys;
    return { ok: true as const, count };
  });

export const upsertEvidenceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        requirementKey: z.string().min(1).optional(),
        title: z.string().min(1),
        evidenceType: TypeEnum,
        attestationText: z.string().nullable().optional(),
        cadence: CadenceEnum.optional(),
        sowCite: z.string().nullable().optional(),
        expiresOn: z.string().nullable().optional(),
        due: DueDraftSchema.optional(),
        hireDate: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const key = data.requirementKey?.trim() || `custom:${newId()}`;
    if (/^(w-?9|i-?9)$/i.test(key) || /^(w-?9|i-?9)$/i.test(data.title.trim())) {
      // Optional custom only — still allowed, but never a catalog built-in.
    }
    for (const subjectId of data.subjectIds) {
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: false,
        custom: {
          title: data.title,
          evidenceType: data.evidenceType,
          attestationText: data.attestationText ?? null,
          cadence: data.cadence ?? cadenceFromDue(data.due?.renewYears ?? null),
          sowCite: data.sowCite ?? null,
          due: data.due,
          hireDate: data.hireDate ?? null,
        },
      });
      if (data.expiresOn) {
        row.expires_on = data.expiresOn;
        row.next_due_on = data.expiresOn;
        row.first_due_rule = "set_date";
        row.first_due_on = data.expiresOn;
      }
      await insertItem(sb, viaTables, data.organizationId, row);
    }
    return { ok: true as const, requirementKey: key };
  });

export const removeEvidenceRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    await deleteItem(sb, viaTables, data.organizationId, data.itemId);
    return { ok: true as const };
  });

export const saveEvidenceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(80),
        subjectType: SubjectEnum,
        packKeys: z.array(z.string()),
        requirementKeys: z.array(z.string()).min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, id: null as string | null };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    const row: EvidenceTemplateRow = {
      id: newId(),
      organization_id: data.organizationId,
      name: data.name.trim(),
      subject_type: data.subjectType,
      pack_keys: data.packKeys,
      requirement_keys: data.requirementKeys,
      created_at: nowIso(),
    };
    requireTables(viaTables);
    const { error } = await sb.from("evidence_templates").insert({
      ...row,
      created_by: userId,
    });
    if (error) throw new Error(mapEvidenceDbError(error.message));
    return { ok: true as const, id: row.id };
  });

export const sendEvidenceToStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemIds: z.array(z.string().uuid()).min(1),
        staffId: z.string().uuid().optional(),
        message: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, messageStored: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { store, viaTables, hasSendMessage } = await loadAll(sb, data.organizationId);
    const note = (data.message ?? "").trim();
    const wantMessage = note.length > 0;
    let messageStored = false;
    const notified = new Set<string>();
    for (const itemId of data.itemIds) {
      const found = store.items.find((i) => i.id === itemId);
      if (!found) continue;
      const staffId =
        data.staffId ??
        (found.subject_type === "staff" ? found.subject_id : found.visible_to_staff_id);
      if (!staffId) continue;
      const patch: Partial<EvidenceItemRow> = {
        sent_to_staff: true,
        visible_to_staff_id: staffId,
      };
      if (wantMessage && hasSendMessage) {
        patch.send_message = note;
        messageStored = true;
      }
      try {
        await patchItem(sb, viaTables, data.organizationId, itemId, patch);
      } catch (err) {
        const text = err instanceof Error ? err.message : "";
        if (wantMessage && sendMessageColumnMissing(text)) {
          await patchItem(sb, viaTables, data.organizationId, itemId, {
            sent_to_staff: true,
            visible_to_staff_id: staffId,
          });
          messageStored = false;
        } else {
          throw err;
        }
      }
      if (!notified.has(staffId)) {
        await notifyStaffNoPhi(sb, data.organizationId, staffId);
        notified.add(staffId);
      }
    }
    return {
      ok: true as const,
      messageStored,
      messageSkipped: wantMessage && !messageStored,
      skipReason: wantMessage && !messageStored ? EVIDENCE_SEND_MESSAGE_UNAVAILABLE : null,
    };
  });

export const recordEvidenceUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        storagePath: z.string().min(1),
        filename: z.string().min(1),
        expiresOn: z.string().nullable().optional(),
        documentDate: z.string().nullable().optional(),
        nextDueOn: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "employee");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const isAdmin = true;
    void isAdmin;
    const row: EvidenceFileRow = {
      id: newId(),
      organization_id: data.organizationId,
      item_id: data.itemId,
      storage_path: data.storagePath,
      filename: data.filename,
      attested_at: null,
      attested_by: null,
      attestation_text_snapshot: null,
      uploaded_by: userId,
      uploaded_at: nowIso(),
      notes: data.notes ?? null,
    };
    await insertFileRow(sb, viaTables, data.organizationId, row);
    const documentDate = parseIsoDate(data.documentDate) ?? found.document_date;
    const nextDue =
      parseIsoDate(data.nextDueOn) ??
      parseIsoDate(data.expiresOn) ??
      applyDueDraft({
        draft: {
          firstDueRule: found.first_due_rule ?? "set_date",
          firstDueOn: found.first_due_on,
          renewYears: found.renew_years,
          nextDueMode: found.renew_years ? "years" : found.next_due_on ? "set_date" : "none",
          nextDueOn: found.next_due_on,
        },
        hireDate: null,
        documentDate,
        hasFile: true,
      }).next_due_on;
    const duePatch = {
      document_date: documentDate,
      next_due_on: nextDue,
      expires_on: nextDue,
    };
    await patchItem(sb, viaTables, data.organizationId, data.itemId, duePatch);
    if (found.dual_link_peer_id) {
      await patchItem(sb, viaTables, data.organizationId, found.dual_link_peer_id, duePatch);
      await insertFileRow(sb, viaTables, data.organizationId, {
        ...row,
        id: newId(),
        item_id: found.dual_link_peer_id,
      });
    }
    return { ok: true as const };
  });

export const recordEvidenceAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        attestationText: z.string().min(1),
        documentDate: z.string().nullable().optional(),
        nextDueOn: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "employee");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const row: EvidenceFileRow = {
      id: newId(),
      organization_id: data.organizationId,
      item_id: data.itemId,
      storage_path: null,
      filename: null,
      attested_at: nowIso(),
      attested_by: userId,
      attestation_text_snapshot: data.attestationText,
      uploaded_by: userId,
      uploaded_at: nowIso(),
      notes: null,
    };
    await insertFileRow(sb, viaTables, data.organizationId, row);
    const documentDate = parseIsoDate(data.documentDate) ?? found.document_date ?? todayStamp();
    const nextDue =
      parseIsoDate(data.nextDueOn) ??
      applyDueDraft({
        draft: {
          firstDueRule: found.first_due_rule ?? "set_date",
          firstDueOn: found.first_due_on,
          renewYears: found.renew_years,
          nextDueMode: found.renew_years ? "years" : found.next_due_on ? "set_date" : "none",
          nextDueOn: found.next_due_on,
        },
        hireDate: null,
        documentDate,
        hasFile: true,
      }).next_due_on;
    const duePatch = {
      document_date: documentDate,
      next_due_on: nextDue,
      expires_on: nextDue,
    };
    await patchItem(sb, viaTables, data.organizationId, data.itemId, duePatch);
    if (found.dual_link_peer_id) {
      await insertFileRow(sb, viaTables, data.organizationId, {
        ...row,
        id: newId(),
        item_id: found.dual_link_peer_id,
      });
      await patchItem(sb, viaTables, data.organizationId, found.dual_link_peer_id, duePatch);
    }
    return { ok: true as const };
  });

export const listMySentEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId)
      return { items: [] as EvidenceItemRow[], files: [] as EvidenceFileRow[] };
    await requireOrgMembership(supabase, userId, data.organizationId, "employee");
    const sb = supabase as AnySupabase;
    const { store } = await loadAll(sb, data.organizationId);
    const items = store.items.filter((i) => i.sent_to_staff && i.visible_to_staff_id === userId);
    const files = store.files.filter((f) => items.some((i) => i.id === f.item_id));
    return { items, files };
  });

export const linkHostHomeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        peerSubjectId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const peerKey = hostHomeDualLinkPeerKey(found.requirement_key);
    if (!peerKey) throw new Error("This row is not a Host Home Certification dual-link.");
    const peerSubject: EvidenceSubject = found.subject_type === "staff" ? "client" : "staff";
    let peer = store.items.find(
      (i) =>
        i.subject_type === peerSubject &&
        i.subject_id === data.peerSubjectId &&
        i.requirement_key === peerKey,
    );
    if (!peer) {
      peer = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: peerSubject,
        subjectId: data.peerSubjectId,
        requirementKey: peerKey,
        suggested: true,
      });
      await insertItem(sb, viaTables, data.organizationId, peer);
    }
    await patchItem(sb, viaTables, data.organizationId, found.id, {
      dual_link_peer_id: peer.id,
      dual_link_key: "host_home_cert",
    });
    await patchItem(sb, viaTables, data.organizationId, peer.id, {
      dual_link_peer_id: found.id,
      dual_link_key: "host_home_cert",
    });
    return { ok: true as const, peerId: peer.id };
  });

export const createEvidenceChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: SubjectEnum,
        subjectIds: z.array(z.string().uuid()).min(1),
        title: z.string().min(1).max(160),
        description: z.string().max(2000).optional(),
        questions: z.array(z.string().min(1).max(400)).min(1).max(40),
        cadence: CadenceEnum.optional(),
        due: DueDraftSchema.optional(),
        hireDate: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const, requirementKey: null as string | null };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { viaTables } = await loadAll(sb, data.organizationId);
    requireTables(viaTables);
    const key = `form:${newId()}`;
    const prompts = data.questions.map((q) => q.trim()).filter(Boolean);
    const attestationText = prompts.map((q, i) => `${i + 1}. ${q}`).join("\n");
    for (const subjectId of data.subjectIds) {
      const row = buildItemFromKey({
        organizationId: data.organizationId,
        subjectType: data.subjectType,
        subjectId,
        requirementKey: key,
        suggested: false,
        custom: {
          title: data.title.trim(),
          evidenceType: "attestation",
          attestationText,
          cadence: data.cadence ?? cadenceFromDue(data.due?.renewYears ?? null),
          sowCite: "Agency form",
          due: data.due,
          hireDate: data.hireDate ?? null,
        },
      });
      await insertItem(sb, viaTables, data.organizationId, row);
    }
    try {
      const fields = prompts.map((label, i) => ({
        id: `q${i + 1}`,
        type: "yes_no",
        label,
        required: true,
      }));
      const assignedUsers = data.subjectType === "staff" ? data.subjectIds : [];
      const assignedClients = data.subjectType === "client" ? data.subjectIds : [];
      await sb.from("forms").insert({
        organization_id: data.organizationId,
        name: data.title.trim(),
        description: data.description?.trim() || null,
        category: "evidence",
        fields,
        frequency: "as_needed",
        schedule: {},
        assigned_groups: [],
        assigned_users: assignedUsers,
        all_clients: data.subjectType !== "client",
        assigned_clients: assignedClients,
        settings: { source: "evidence", requirement_key: key },
        created_by: userId,
      });
    } catch {
      /* Forms table is optional — evidence row is the source of truth. */
    }
    return { ok: true as const, requirementKey: key };
  });

export const updateEvidenceDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        itemId: z.string().uuid(),
        due: DueDraftSchema,
        hireDate: z.string().nullable().optional(),
        documentDate: z.string().nullable().optional(),
        hasFile: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false as const };
    await requireOrgMembership(supabase, userId, data.organizationId, "manager");
    const sb = supabase as AnySupabase;
    const { store, viaTables } = await loadAll(sb, data.organizationId);
    const found = store.items.find((i) => i.id === data.itemId);
    if (!found) throw new Error("Evidence item not found");
    const computed = applyDueDraft({
      draft: data.due,
      hireDate: data.hireDate ?? null,
      documentDate: data.documentDate ?? found.document_date,
      hasFile: data.hasFile ?? !!latestFileForItem(store.files, found.id),
    });
    await patchItem(sb, viaTables, data.organizationId, data.itemId, {
      first_due_rule: computed.first_due_rule,
      first_due_on: computed.first_due_on,
      document_date: computed.document_date,
      next_due_on: computed.next_due_on,
      renew_years: computed.renew_years,
      expires_on: computed.expires_on,
      cadence: cadenceFromDue(computed.renew_years),
    });
    return { ok: true as const };
  });

export function unusedPackGuard(packKey: string): boolean {
  return !!packByKey(packKey);
}

export type { EvidenceCellStatus };
