// Server function for the support strategies document: the APPROVED
// strategies as the preview model plus the PDF (strategies-doc.server.ts).
// Read-only, but for editors only (assertCanManageClient "edit"): staff see
// strategies on the time clock and daily notes, never this document.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import type { StrategiesDoc } from "./strategies-doc";
import { loadStrategiesDocument } from "./strategies-doc.server";
import { toBase64 } from "./strategies-pdf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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
        action: "edit",
      });
      const { doc, pdf, filename } = await loadStrategiesDocument(supabase, client);
      return { doc, pdfBase64: toBase64(pdf), filename };
    },
  );
