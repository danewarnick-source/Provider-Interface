// Agency facts for owners and agency-wide admins asking in the admin view
// (N5): required policy status, review counts and team and client counts. No
// runtime aliases, so node --test can import it. Team members never get these.

import type { NectarAskCaller, NectarDb, NectarFact } from "../engine/ask-types.ts";
import { audienceMembers } from "../library/audience.ts";
import { REVIEW_GROUPS, reviewCounts, type ReviewRow } from "../library/reviews.ts";
import {
  requiredSlotStatus,
  SLOT_STATUS_LABEL,
  slotCodeLabel,
  type AgencyToggles,
  type SlotDef,
  type SlotDocument,
} from "../library/slots.ts";

export const AGENCY_FACT_IDS = {
  required: "agency:required",
  reviews: "agency:reviews",
  counts: "agency:counts",
} as const;

const PAGE = 1000;

export interface ReviewedPolicy {
  id: string;
  title: string;
  version: number;
  audience_all: boolean | null;
  policy_assigned_users: string[] | null;
}

function agencyFact(id: string, title: string, text: string): NectarFact {
  return { id, kind: "agency", title, heading: null, text, clientId: null };
}

/** "X of Y required policies published and current", then each slot that applies. */
export function requiredFact(
  slots: readonly SlotDef[],
  docs: readonly SlotDocument[],
  toggles: AgencyToggles,
  today: string,
): NectarFact {
  const status = requiredSlotStatus(slots, docs, toggles, today);
  const rows = status.rows
    .filter((r) => r.applies)
    .map(
      (r) =>
        `- ${slotCodeLabel(r.code)} ${r.label}: ${SLOT_STATUS_LABEL[r.status]}${r.documentTitle ? ` (${r.documentTitle})` : ""}`,
    );
  return agencyFact(
    AGENCY_FACT_IDS.required,
    "Required policies (DHHS91172)",
    [
      `${status.current} of ${status.required} required policies are published and current.`,
      `Provides transportation: ${toggles.provides_transportation ? "yes" : "no"}. Manages clients' personal money: ${toggles.manages_client_money ? "yes" : "no"}.`,
      ...rows,
    ].join("\n"),
  );
}

/** Each published policy or procedure: how many of the people it is for reviewed this version. */
export function reviewsFact(
  policies: readonly ReviewedPolicy[],
  memberIds: readonly string[],
  reviews: readonly ReviewRow[],
): NectarFact {
  const lines = [...policies]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => {
      const { reviewed, total } = reviewCounts(p, memberIds, reviews);
      const who =
        audienceMembers(p, memberIds).length === memberIds.length ? "" : " (selected people)";
      return `- ${p.title} v${p.version}: ${reviewed} of ${total} reviewed${who}`;
    });
  return agencyFact(
    AGENCY_FACT_IDS.reviews,
    "Policy reviews",
    lines.length
      ? `Reviews of the current version of each published policy and procedure:\n${lines.join("\n")}`
      : "No policies or procedures are published yet.",
  );
}

export function countsFact(counts: {
  activeMembers: number;
  activeClients: number | null;
  allClients: number | null;
}): NectarFact {
  const clients =
    counts.allClients === null
      ? "Client counts are unavailable."
      : `${counts.activeClients ?? 0} active clients (${counts.allClients} in all).`;
  return agencyFact(
    AGENCY_FACT_IDS.counts,
    "Team and client counts",
    `${counts.activeMembers} active team members. ${clients}`,
  );
}

async function loadReviewRows(db: NectarDb, docIds: string[]): Promise<ReviewRow[]> {
  const out: ReviewRow[] = [];
  if (!docIds.length) return out;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("policy_signatures")
      .select("document_id, document_version, user_id, signed_at")
      .in("document_id", docIds)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Could not load policy reviews.");
    out.push(...((data ?? []) as ReviewRow[]));
    if ((data ?? []).length < PAGE) return out;
  }
}

/** The admin view's agency facts; none for anyone else. */
export async function loadAgencyFacts(
  db: NectarDb,
  caller: NectarAskCaller,
  today: string,
): Promise<NectarFact[]> {
  if (caller.view !== "admin" || !caller.agencyAdmin) return [];
  const orgId = caller.orgId;
  const [slots, toggles, slotDocs, policies, members, allClients, activeClients] =
    await Promise.all([
      db
        .from("required_policy_slots")
        .select("id, code, label, applies_when, position")
        .order("position"),
      db
        .from("organizations")
        .select("provides_transportation, manages_client_money")
        .eq("id", orgId)
        .maybeSingle(),
      db
        .from("nectar_documents")
        .select("id, title, required_slot, library_status, review_due, superseded_by")
        .eq("organization_id", orgId)
        .not("required_slot", "is", null)
        .not("library_group", "is", null),
      db
        .from("nectar_documents")
        .select("id, title, version, audience_all, policy_assigned_users")
        .eq("organization_id", orgId)
        .eq("owner_kind", "company")
        .eq("library_status", "published")
        .is("superseded_by", null)
        .in("library_group", [...REVIEW_GROUPS]),
      db
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("active", true),
      db.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      db
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("account_status", "active"),
    ]);
  if (
    slots.error ||
    toggles.error ||
    !toggles.data ||
    slotDocs.error ||
    policies.error ||
    members.error
  ) {
    throw new Error("Could not load your agency's facts.");
  }
  const memberIds = [...new Set((members.data ?? []).map((m) => m.user_id))];
  const policyRows = (policies.data ?? []) as ReviewedPolicy[];
  const reviews = await loadReviewRows(
    db,
    policyRows.map((p) => p.id),
  );
  return [
    requiredFact(slots.data ?? [], slotDocs.data ?? [], toggles.data, today),
    reviewsFact(policyRows, memberIds, reviews),
    countsFact({
      activeMembers: memberIds.length,
      activeClients: activeClients.error ? null : (activeClients.count ?? 0),
      allClients: allClients.error ? null : (allClients.count ?? 0),
    }),
  ];
}
