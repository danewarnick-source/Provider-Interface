// Reopening a finalized progress summary for edits. The finalized copy is
// never deleted: it moves into draft_source.versions as a superseded
// version, and draft_source.reopens records who reopened it, when, why, and
// which filing attestations (UPI entry, sent to the Support Coordinator)
// were withdrawn with it. The row goes back to "in_review" with every
// finalize / attestation column cleared, so everything that reads those
// columns (the summaries list and deadlines, the client file's Service
// summary card, the client list and overview) counts it as not done until
// it is finalized again. Pure, node --test.

/** The columns a finalize or a filing attestation writes. */
export const FINALIZE_COLUMNS = [
  "final_content",
  "finalized_at",
  "finalized_by",
  "finalized_by_name",
  "ai_review_attested_at",
  "ai_review_attested_by",
  "completed_at",
  "completed_by",
  "upi_entered_at",
  "upi_entered_by",
  "sc_sent_at",
  "sc_sent_by",
] as const;

export type FinalizeColumn = (typeof FINALIZE_COLUMNS)[number];

export type ReopenableRow = { status: string } & Partial<Record<FinalizeColumn, string | null>>;

/** A finalized copy kept after a reopen. */
export interface SupersededVersion {
  columns: Partial<Record<FinalizeColumn, string | null>>;
  finalDoc: unknown;
  supersededAt: string;
  supersededBy: string;
}

export interface ReopenEvent {
  by: string;
  byName: string | null;
  at: string;
  reason: string | null;
  /** The finalize this reopen withdrew. */
  finalizedAt: string | null;
  /** Filing attestations withdrawn with it. */
  withdrew: { upiEnteredAt: string | null; scSentAt: string | null };
}

/** True when the summary counts as done and can be reopened. */
export function canReopenSummary(
  row: Pick<ReopenableRow, "status" | "finalized_at" | "completed_at">,
): boolean {
  return row.status === "finalized" || !!row.finalized_at || !!row.completed_at;
}

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * The row update for a reopen: every finalize / attestation column cleared,
 * status back to in_review, and draft_source with the finalized copy kept
 * as a superseded version and the reopen recorded.
 */
export function reopenPatch(
  row: ReopenableRow,
  draftSource: Record<string, unknown> | null | undefined,
  who: { by: string; byName: string | null; at: string },
  reason: string | null | undefined,
): Record<string, unknown> {
  if (!canReopenSummary(row)) throw new Error("This summary is not finalized.");
  const ds = { ...(draftSource ?? {}) };
  const columns: SupersededVersion["columns"] = {};
  for (const c of FINALIZE_COLUMNS) columns[c] = row[c] ?? null;
  const version: SupersededVersion = {
    columns,
    finalDoc: ds.final_doc ?? null,
    supersededAt: who.at,
    supersededBy: who.by,
  };
  const event: ReopenEvent = {
    ...who,
    reason: reason?.trim() ? reason.trim().slice(0, 500) : null,
    finalizedAt: row.finalized_at ?? row.completed_at ?? null,
    withdrew: { upiEnteredAt: row.upi_entered_at ?? null, scSentAt: row.sc_sent_at ?? null },
  };
  delete ds.final_doc;
  const patch: Record<string, unknown> = {
    status: "in_review",
    draft_source: {
      ...ds,
      versions: [...list<SupersededVersion>(ds.versions), version],
      reopens: [...list<ReopenEvent>(ds.reopens), event],
    },
  };
  for (const c of FINALIZE_COLUMNS) patch[c] = null;
  return patch;
}

/** The saved reopen history, newest first. */
export function readReopenHistory(draftSource: unknown): ReopenEvent[] {
  const ds =
    draftSource && typeof draftSource === "object" ? (draftSource as Record<string, unknown>) : {};
  return list<Record<string, unknown>>(ds.reopens)
    .filter((e) => e && typeof e.by === "string" && typeof e.at === "string")
    .map((e) => {
      const w = (e.withdrew ?? {}) as Record<string, unknown>;
      const s = (v: unknown) => (typeof v === "string" && v ? v : null);
      return {
        by: e.by as string,
        at: e.at as string,
        byName: s(e.byName),
        reason: s(e.reason),
        finalizedAt: s(e.finalizedAt),
        withdrew: { upiEnteredAt: s(w.upiEnteredAt), scSentAt: s(w.scSentAt) },
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** "Reopened Oct 8, 2026 by Ann Admin — typo in goal 2. UPI entry attestation withdrawn." */
export function reopenEventLine(e: ReopenEvent): string {
  const when = new Date(e.at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
  const withdrawn = [
    e.withdrew.upiEnteredAt ? "UPI entry attestation withdrawn." : "",
    e.withdrew.scSentAt ? "Sent to Support Coordinator attestation withdrawn." : "",
  ].filter(Boolean);
  return [
    `Reopened ${when} by ${e.byName ?? "a team member"}${e.reason ? ` — ${e.reason}` : ""}.`,
    ...withdrawn,
  ].join(" ");
}
