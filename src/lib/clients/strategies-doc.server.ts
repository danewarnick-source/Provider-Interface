// Reads the APPROVED support strategies document for one client: agency,
// client, current plan year, support coordinator, approver and the
// strategies. Shared by the download (strategies-doc.functions.ts) and
// "Mark as sent", which files the same PDF as Evidence. Callers check access.

import { activeContacts, loadClientContacts, primaryContact } from "./contacts";
import { todayYmd } from "./dates";
import { currentPlan, type ClientPlan } from "./plans";
import { buildStrategiesDoc, strategiesFileName, type StrategiesDoc } from "./strategies-doc";
import { renderStrategiesPdf } from "./strategies-pdf";
import type { CSTContent } from "./training.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const fullName = (
  p: { first_name?: string | null; last_name?: string | null } | null,
): string => [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();

/** The client's current support coordinator (client_contacts), or null. */
export async function coordinatorName(sb: AnySupabase, clientId: string): Promise<string | null> {
  const contacts = await loadClientContacts(sb, [clientId]);
  return primaryContact(activeContacts(contacts), "support_coordinator")?.name ?? null;
}

/** The document model, its PDF and file name. Throws when not approved or uploaded. */
export async function loadStrategiesDocument(
  sb: AnySupabase,
  client: {
    id: string;
    organization_id: string;
    first_name: string | null;
    last_name: string | null;
  },
): Promise<{ doc: StrategiesDoc; pdf: Uint8Array; filename: string }> {
  const [orgRes, trainingRes, planRes, coordinator] = await Promise.all([
    sb
      .from("organizations")
      .select("name, legal_name, dba_name")
      .eq("id", client.organization_id)
      .maybeSingle(),
    sb
      .from("client_specific_trainings")
      .select("content, status, approved_at, approved_by")
      .eq("client_id", client.id)
      .eq("training_type", "support_strategies")
      .maybeSingle(),
    sb
      .from("client_plans")
      .select(
        "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id",
      )
      .eq("client_id", client.id),
    coordinatorName(sb, client.id),
  ]);
  const training = trainingRes.data as {
    content: CSTContent | null;
    status: string;
    approved_at: string | null;
    approved_by: string | null;
  } | null;
  if (!training || training.status !== "published" || !training.approved_at) {
    throw new Error("Approve the support strategies first, then download the document.");
  }
  const { data: approver } = training.approved_by
    ? await sb
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", training.approved_by)
        .maybeSingle()
    : { data: null };
  const org = orgRes.data as {
    name: string | null;
    legal_name: string | null;
    dba_name: string | null;
  } | null;
  const clientName = fullName(client);
  const doc = buildStrategiesDoc({
    providerName: org?.dba_name || org?.legal_name || org?.name || null,
    clientName,
    plan: currentPlan((planRes.data ?? []) as ClientPlan[]),
    coordinatorName: coordinator,
    approverName: fullName(approver) || null,
    approvedAt: training.approved_at,
    preparedOn: todayYmd(),
    content: training.content,
  });
  if (!doc) throw new Error("These strategies are an uploaded document; open that file instead.");
  return { doc, pdf: await renderStrategiesPdf(doc), filename: strategiesFileName(clientName) };
}
