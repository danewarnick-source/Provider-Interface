// Nectar's discharge summary draft. Reads only what is on file for the client
// (services, current plan goals, how many daily notes) with the caller's
// RLS-scoped client, and asks Nectar for a short draft. The draft is always
// marked as Nectar's and a person must read and confirm it before it counts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { rows } from "./list-queries";
import { addDays, parseSummaryDraft, summaryFactsText, type InitiatedBy } from "./discharge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const SYSTEM = [
  "You are NECTAR, helping a Utah DSPD provider agency write a discharge summary for a client.",
  "Using ONLY the facts provided, write 2-4 short plain-English paragraphs: why services are ending, the services the agency provided and for how long, the plan goals worked on, and anything the next provider should know that appears in the facts.",
  "Do NOT invent facts, events, progress, diagnoses or recommendations that are not in the facts. When something isn't on file, leave it out.",
  "This is a DRAFT a staff member will read, edit and confirm.",
  'Respond ONLY with JSON: { "summary": "..." }.',
].join("\n");

export async function draftDischargeSummaryText(
  sb: Sb,
  args: {
    organizationId: string;
    clientId: string;
    dischargeDate: string;
    reason: string;
    initiatedBy: InitiatedBy;
  },
): Promise<string> {
  const { organizationId: org, clientId } = args;
  const [client] = await rows<{ first_name: string | null; admission_date: string | null }>(
    sb
      .from("clients")
      .select("first_name, admission_date")
      .eq("organization_id", org)
      .eq("id", clientId),
  );
  const services = await rows<{
    service_code: string;
    service_start_date: string | null;
    service_end_date: string | null;
  }>(
    sb
      .from("client_billing_codes")
      .select("service_code, service_start_date, service_end_date")
      .eq("organization_id", org)
      .eq("client_id", clientId),
  ).catch(() => []);
  const goals = await rows<{ goal_text: string | null }>(
    sb
      .from("client_goals")
      .select("goal_text")
      .eq("organization_id", org)
      .eq("client_id", clientId)
      .is("ended_on", null)
      .limit(12),
  ).catch(() => []);
  const { count } = await sb
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("client_id", clientId)
    .gte("log_date", addDays(args.dischargeDate, -90));

  const facts = summaryFactsText({
    firstName: client?.first_name ?? "",
    admissionDate: client?.admission_date ?? null,
    dischargeDate: args.dischargeDate,
    reason: args.reason,
    initiatedBy: args.initiatedBy,
    services: services.map((s) => ({
      code: s.service_code,
      start: s.service_start_date,
      end: s.service_end_date,
    })),
    goals: goals.map((g) => (g.goal_text ?? "").trim()).filter(Boolean),
    notesInLast90Days: count ?? 0,
  });

  const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
  const res = await gatewayFetch(
    {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `FACTS:\n${facts}` },
      ],
      response_format: { type: "json_object" },
    },
    { orgId: org },
  );
  if (!res.ok) throw new Error("Nectar couldn't draft the summary right now. Write it by hand.");
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = parseSummaryDraft(body?.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error("Nectar couldn't draft the summary right now. Write it by hand.");
  return text;
}
