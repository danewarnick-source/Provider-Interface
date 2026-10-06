// Upload a PCSP and/or pull its goals into the current plan (NECTAR, verbatim).
// Replaced by the plain-code PCSP reader in a later step.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractPcspGoalsForTraining } from "@/lib/clients/training.functions";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { onPcspActivated } from "@/lib/company-obligations.functions";
import { clientPlansKey } from "@/components/clients/shared/hooks/use-plan-goals";

export function usePcspGoalExtract(clientId: string, orgId: string | undefined) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractPcspGoalsForTraining);
  const writeRecordFn = useServerFn(writeClientRecord);
  const pcspClockFn = useServerFn(onPcspActivated);
  const [busy, setBusy] = useState(false);

  const hasPcsp = useQuery({
    queryKey: ["client-has-pcsp", clientId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("client_documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .ilike("document_type", "pcsp");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  }).data;

  async function extract() {
    const res = await extractFn({ data: { clientId } });
    if (!res?.ok) {
      toast.error(res?.reason ?? "Extraction failed");
      return;
    }
    toast.success(`Pulled ${res.goalCount} goals from the PCSP into the current plan`);
    qc.invalidateQueries({ queryKey: clientPlansKey(clientId) });
    qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const runExtract = () => run(extract);

  const uploadAndExtract = (file: File) =>
    run(async () => {
      if (!orgId) throw new Error("Organization not loaded");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/${clientId}/pcsp/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      await writeRecordFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "client_documents",
          op: "insert",
          values: { document_type: "pcsp", file_name: file.name, file_url: path, storage_path: path },
        },
      });
      try {
        await pcspClockFn({ data: { organizationId: orgId, clientId } });
      } catch {
        /* Event clock must not block the PCSP upload. */
      }
      // PCSP is one document shown in both Care and Files — refresh both.
      qc.invalidateQueries({ queryKey: ["client-docs", orgId, clientId] });
      qc.invalidateQueries({ queryKey: ["client-has-pcsp", clientId] });
      await extract();
    });

  return { busy, hasPcsp: !!hasPcsp, runExtract, uploadAndExtract };
}
