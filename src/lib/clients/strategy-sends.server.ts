// Reads behind the support strategies send rule (strategy-sends.ts) for a set
// of clients: codes, plans, approval, live sends, and the accepted
// "Support Strategies" Evidence file kept from before sends were recorded.
// Runs with the caller's RLS-scoped client; a read that fails counts as empty.

import { denverYmd, denverYmdFromInstant } from "@/lib/denver-date";
import { loadActiveCodes } from "./codes";
import { chunkIds, maybe, type AnySupabase } from "./file-index-queries";
import { currentPlan, type ClientPlan } from "./plans";
import { personNeedsSupportStrategies } from "./strategy-rules";
import {
  strategiesApprovedFor,
  strategySendState,
  type LegacyStrategyFile,
  type StrategySend,
  type StrategySendState,
} from "./strategy-sends";

export const STRATEGIES_KEY = "support_strategies";

const PLAN_COLUMNS =
  "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id, created_at";

type SendRow = {
  id: string;
  client_id: string;
  plan_id: string;
  sent_on: string;
  sent_to: string | null;
  recorded_by: string;
  evidence_file_id: string | null;
  voided_at: string | null;
};
type FileRow = {
  id: string;
  item_id: string;
  storage_path: string | null;
  filename: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  review_status: string | null;
};

const fullName = (p: { first_name: string | null; last_name: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim();

/** Names by user id (profiles), for "· Dane Warnick". */
async function loadNames(sb: AnySupabase, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const chunk of chunkIds([...new Set(ids.filter(Boolean))])) {
    const rows = await maybe(
      () => sb.from("profiles").select("id, first_name, last_name").in("id", chunk),
      [] as Array<{ id: string; first_name: string | null; last_name: string | null }>,
    );
    for (const p of rows) if (fullName(p)) out.set(p.id, fullName(p));
  }
  return out;
}

/** The send state per client. Pass codes / plans already read to skip those reads. */
export async function loadStrategyStates(
  sb: AnySupabase,
  organizationId: string,
  clientIds: string[],
  known: { codes?: Map<string, string[]>; plans?: Map<string, ClientPlan[]> } = {},
  now: Date = new Date(),
): Promise<Map<string, StrategySendState>> {
  const out = new Map<string, StrategySendState>();
  if (!clientIds.length) return out;
  const codes = known.codes ?? (await loadActiveCodes(sb, clientIds).catch(() => new Map()));
  const plans = known.plans ?? new Map<string, ClientPlan[]>();
  const trainings: Array<{ client_id: string; status: string | null; approved_at: string | null }> =
    [];
  const sends: SendRow[] = [];
  const items: Array<{ id: string; subject_id: string }> = [];
  for (const ids of chunkIds(clientIds)) {
    const [t, s, i, p] = await Promise.all([
      maybe(
        () =>
          sb
            .from("client_specific_trainings")
            .select("client_id, status, approved_at")
            .eq("organization_id", organizationId)
            .eq("training_type", "support_strategies")
            .in("client_id", ids),
        [] as typeof trainings,
      ),
      maybe(
        () =>
          sb
            .from("client_strategy_sends")
            .select(
              "id, client_id, plan_id, sent_on, sent_to, recorded_by, evidence_file_id, voided_at",
            )
            .eq("organization_id", organizationId)
            .in("client_id", ids),
        [] as SendRow[],
      ),
      maybe(
        () =>
          sb
            .from("evidence_items")
            .select("id, subject_id")
            .eq("organization_id", organizationId)
            .eq("subject_type", "client")
            .eq("requirement_key", STRATEGIES_KEY)
            .is("opted_out_at", null)
            .in("subject_id", ids),
        [] as typeof items,
      ),
      known.plans
        ? Promise.resolve([] as ClientPlan[])
        : maybe(
            () => sb.from("client_plans").select(PLAN_COLUMNS).in("client_id", ids),
            [] as ClientPlan[],
          ),
    ]);
    trainings.push(...t);
    sends.push(...s);
    items.push(...i);
    for (const plan of p) plans.set(plan.client_id, [...(plans.get(plan.client_id) ?? []), plan]);
  }
  const files: FileRow[] = [];
  for (const ids of chunkIds(items.map((i) => i.id))) {
    files.push(
      ...(await maybe(
        () =>
          sb
            .from("evidence_files")
            .select("id, item_id, storage_path, filename, uploaded_by, uploaded_at, review_status")
            .in("item_id", ids),
        [] as FileRow[],
      )),
    );
  }
  const live = sends.filter((s) => !s.voided_at);
  const names = await loadNames(sb, [
    ...live.map((s) => s.recorded_by),
    ...files.map((f) => f.uploaded_by ?? ""),
  ]);
  // Snapshots of sends (voided ones included) never count as an older upload.
  const sendFiles = new Set(sends.map((s) => s.evidence_file_id).filter(Boolean));
  const clientOfItem = new Map(items.map((i) => [i.id, i.subject_id]));
  const legacy = new Map<string, LegacyStrategyFile & { at: string }>();
  for (const f of files) {
    const clientId = clientOfItem.get(f.item_id);
    const accepted = (f.review_status ?? "accepted") === "accepted";
    if (!clientId || !accepted || sendFiles.has(f.id) || !(f.storage_path || f.filename)) continue;
    const at = f.uploaded_at ?? "";
    if ((legacy.get(clientId)?.at ?? "") > at) continue;
    legacy.set(clientId, {
      at,
      on: denverYmdFromInstant(at) ?? at.slice(0, 10),
      by: f.uploaded_by ? (names.get(f.uploaded_by) ?? null) : null,
    });
  }

  const today = denverYmd(now);
  for (const clientId of clientIds) {
    const plan = currentPlan(plans.get(clientId) ?? [], now);
    const clientSends: StrategySend[] = live
      .filter((s) => s.client_id === clientId)
      .map((s) => ({
        id: s.id,
        planId: s.plan_id,
        sentOn: s.sent_on,
        sentTo: s.sent_to,
        by: names.get(s.recorded_by) ?? null,
      }));
    out.set(
      clientId,
      strategySendState({
        needed: personNeedsSupportStrategies(codes.get(clientId) ?? []),
        plan,
        approved: strategiesApprovedFor(
          trainings.find((t) => t.client_id === clientId) ?? null,
          plan,
        ),
        sends: clientSends,
        legacyFile: legacy.get(clientId) ?? null,
        today,
      }),
    );
  }
  return out;
}
