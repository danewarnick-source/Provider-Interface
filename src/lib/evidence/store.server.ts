// Evidence store: evidence_items / evidence_files with the caller's client (RLS
// applies), shared by Evidence and the Client file. Never deletes (a skip is
// opted_out_* + history); falls back on databases missing newer columns.

import { parseIsoDate } from "./due.ts";
import {
  EVIDENCE_STORAGE_UNAVAILABLE,
  FIRST_DUE_RULES,
  type EvidenceFileRow,
  type EvidenceItemRow,
  type FirstDueRule,
  type RenewYears,
} from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = any;

export type StoreV1 = {
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
};

export function emptyStore(): StoreV1 {
  return { items: [], files: [] };
}

function tableMissing(message: string | undefined): boolean {
  return /does not exist|schema cache|evidence_items|evidence_files/i.test(message ?? "");
}

export function sendMessageColumnMissing(message: string | undefined): boolean {
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

export const ITEM_SELECT_WITH_DUE = `${ITEM_SELECT_BASE.replace(", created_at, updated_at", "")}, send_message, first_due_rule, first_due_on, document_date, next_due_on, renew_years, opted_out_at, opted_out_by, opt_out_reason, history, added_by_hand, description, created_at, updated_at`;

export const FILE_SELECT =
  "id, organization_id, item_id, storage_path, filename, attested_at, attested_by, attestation_text_snapshot, uploaded_by, uploaded_at, notes, review_status, reviewed_by, reviewed_at, review_note";

function asFirstDueRule(value: unknown): FirstDueRule | null {
  return FIRST_DUE_RULES.includes(value as FirstDueRule) ? (value as FirstDueRule) : null;
}

function asRenewYears(value: unknown): RenewYears {
  return value === 1 || value === 2 ? value : null;
}

export function normalizeItem(row: EvidenceItemRow | Record<string, unknown>): EvidenceItemRow {
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
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

/** Skip fields for an item row (only when the row carries them). */
function skipItemPayload(row: EvidenceItemRow): Record<string, unknown> {
  if (!row.opted_out_at) return {};
  return {
    opted_out_at: row.opted_out_at,
    opted_out_by: row.opted_out_by ?? null,
    opt_out_reason: row.opt_out_reason ?? null,
    history: row.history ?? [],
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

/** Where an item came from (one at a time vs. a pack) and a custom item's explanation. */
function originItemPayload(row: EvidenceItemRow): Record<string, unknown> {
  return { added_by_hand: row.added_by_hand ?? false, description: row.description ?? null };
}

export function mapEvidenceDbError(message: string | undefined): string {
  const text = message ?? "";
  if (/feature_config/i.test(text) || tableMissing(text)) {
    return EVIDENCE_STORAGE_UNAVAILABLE;
  }
  return text || EVIDENCE_STORAGE_UNAVAILABLE;
}

export function requireTables(viaTables: boolean): void {
  if (!viaTables) throw new Error(EVIDENCE_STORAGE_UNAVAILABLE);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function loadAll(
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
    if (
      tableMissing(first.error.message) &&
      !sendMessageColumnMissing(first.error.message) &&
      !dueColumnMissing(first.error.message)
    ) {
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
    .select(FILE_SELECT)
    .eq("organization_id", organizationId);
  if (fileErr) {
    if (tableMissing(fileErr.message)) {
      return { store: emptyStore(), viaTables: false, hasSendMessage: false, hasDue: false };
    }
    throw new Error(mapEvidenceDbError(fileErr.message));
  }
  return {
    viaTables: true,
    hasSendMessage,
    hasDue,
    store: {
      items: items ?? [],
      files: (files ?? []) as EvidenceFileRow[],
    },
  };
}

export async function insertItem(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  row: EvidenceItemRow,
): Promise<void> {
  requireTables(viaTables);
  {
    const full = {
      ...coreItemPayload(row),
      ...dueItemPayload(row),
      ...skipItemPayload(row),
      ...originItemPayload(row),
    };
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

export async function patchItem(
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
  for (const k of ["first_due_rule", "first_due_on", "document_date", "next_due_on", "renew_years"])
    delete slim[k];
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

export async function insertFileRow(
  sb: AnySupabase,
  viaTables: boolean,
  organizationId: string,
  row: EvidenceFileRow,
): Promise<void> {
  requireTables(viaTables);
  const { error } = await sb.from("evidence_files").insert(row);
  if (error) throw new Error(mapEvidenceDbError(error.message));
}
