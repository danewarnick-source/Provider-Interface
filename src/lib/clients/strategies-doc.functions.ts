// Server function for the support strategies document: reads the APPROVED
// strategies with the agency, client, plan year, support coordinator and
// approver, and returns the preview model plus the PDF. Read-only; the
// caller must be able to view the client (assertCanManageClient "view").

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { activeContacts, loadClientContacts, primaryContact } from "./contacts";
import { todayYmd } from "./dates";
import { currentPlan, type ClientPlan } from "./plans";
import { buildStrategiesDoc, strategiesFileName, type StrategiesDoc } from "./strategies-doc";
import { renderStrategiesPdf, toBase64 } from "./strategies-pdf";
import type { CSTContent } from "./training.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const fullName = (p: { first_name?: string | null; last_name?: string | null } | null) =>
  [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();

export const getSupportStrategiesDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ doc: StrategiesDoc; pdfBase64: string; filename: string }> => {
      const supabase = context.supabase as AnySupabase;
      const userId = context.userId as string;
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, organization_id, first_name, last_name")
        .eq("id", data.clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!client) throw new Error("Client not found.");
      await assertCanManageClient({
        supabase,
        actorId: userId,
        organizationId: client.organization_id,
        clientId: client.id,
        action: "view",
      });

      const [orgRes, trainingRes, planRes, contacts] = await Promise.all([
        supabase
          .from("organizations")
          .select("name, legal_name, dba_name")
          .eq("id", client.organization_id)
          .maybeSingle(),
        supabase
          .from("client_specific_trainings")
          .select("content, status, approved_at, approved_by")
          .eq("client_id", client.id)
          .eq("training_type", "support_strategies")
          .maybeSingle(),
        supabase
          .from("client_plans")
          .select(
            "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id",
          )
          .eq("client_id", client.id),
        loadClientContacts(supabase, [client.id]),
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
        ? await supabase
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
        coordinatorName:
          primaryContact(activeContacts(contacts), "support_coordinator")?.name ?? null,
        approverName: fullName(approver) || null,
        approvedAt: training.approved_at,
        preparedOn: todayYmd(),
        content: training.content,
      });
      if (!doc)
        throw new Error("These strategies are an uploaded document; open that file instead.");
      const pdfBase64 = toBase64(await renderStrategiesPdf(doc));
      return { doc, pdfBase64, filename: strategiesFileName(clientName) };
    },
  );
