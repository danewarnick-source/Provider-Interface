// The required policies checklist (N3, Decision 3). Pure: no Supabase, no
// aliases, so node --test can import it.
//
// Ten slots from DHHS91172. The transportation slot applies only when the
// agency provides transportation, the personal finances slot only when it
// manages clients' money. Each slot shows Missing, Draft, Published or Past
// review, from the current versions of the documents that fill it.

import { isPastReview } from "./library.ts";

export type SlotStatus = "missing" | "draft" | "published" | "past_review";

export const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  missing: "Missing",
  draft: "Draft",
  published: "Published",
  past_review: "Past review",
};

export interface SlotDef {
  id: string;
  code: string;
  label: string;
  applies_when: string | null;
  position: number;
}

export interface AgencyToggles {
  provides_transportation: boolean;
  manages_client_money: boolean;
}

export interface SlotDocument {
  id: string;
  title: string;
  required_slot: string | null;
  library_status: string;
  review_due: string | null;
  superseded_by: string | null;
}

export interface SlotRow {
  id: string;
  code: string;
  label: string;
  applies: boolean;
  status: SlotStatus;
  documentId: string | null;
  documentTitle: string | null;
}

/** "§1.17(a)" for code "1.17(a)". */
export function slotCodeLabel(code: string): string {
  return `§${code}`;
}

export function slotApplies(slot: Pick<SlotDef, "applies_when">, toggles: AgencyToggles): boolean {
  if (slot.applies_when === "transport") return toggles.provides_transportation;
  if (slot.applies_when === "finances") return toggles.manages_client_money;
  return true;
}

const RANK: Record<SlotStatus, number> = { missing: 0, draft: 1, past_review: 2, published: 3 };

function docStatus(doc: SlotDocument, today: string): SlotStatus | null {
  if (doc.superseded_by) return null;
  if (doc.library_status === "draft") return "draft";
  if (doc.library_status !== "published") return null;
  return isPastReview(doc.review_due, today) ? "past_review" : "published";
}

/**
 * One row per slot, in order, with the best status of the current documents
 * filling it. `current` counts applicable slots that are published and not
 * past review ("X of Y required policies published and current").
 */
export function requiredSlotStatus(
  slots: readonly SlotDef[],
  documents: readonly SlotDocument[],
  toggles: AgencyToggles,
  today: string,
): { rows: SlotRow[]; current: number; required: number } {
  const rows = [...slots]
    .sort((a, b) => a.position - b.position)
    .map((slot): SlotRow => {
      let best: { status: SlotStatus; doc: SlotDocument | null } = { status: "missing", doc: null };
      for (const doc of documents) {
        if (doc.required_slot !== slot.id) continue;
        const status = docStatus(doc, today);
        if (status && RANK[status] > RANK[best.status]) best = { status, doc };
      }
      return {
        id: slot.id,
        code: slot.code,
        label: slot.label,
        applies: slotApplies(slot, toggles),
        status: best.status,
        documentId: best.doc?.id ?? null,
        documentTitle: best.doc?.title ?? null,
      };
    });
  const applicable = rows.filter((r) => r.applies);
  return {
    rows,
    current: applicable.filter((r) => r.status === "published").length,
    required: applicable.length,
  };
}
