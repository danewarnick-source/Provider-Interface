// Upload a PCSP → read it → hold the editable review → confirm.
// Nothing about the plan is written until confirm().
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmPcsp, readPcsp, type PcspRead } from "@/lib/clients/pcsp/import.functions";
import { initialReview, type ReviewedPcsp } from "@/lib/clients/pcsp/review";
import { onPcspActivated } from "@/lib/company-obligations.functions";
import { clientPlansKey } from "@/components/clients/shared/hooks/use-plan-goals";
import { clientContactsKey } from "@/components/clients/shared/hooks/use-client-contacts";
import { fileToBase64 } from "@/components/clients/shared/file-to-base64";

export function usePcspImport(clientId: string, orgId: string | undefined) {
  const qc = useQueryClient();
  const readFn = useServerFn(readPcsp);
  const confirmFn = useServerFn(confirmPcsp);
  const clockFn = useServerFn(onPcspActivated);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [read, setRead] = useState<PcspRead | null>(null);
  const [review, setReview] = useState<ReviewedPcsp | null>(null);

  async function upload(file: File) {
    if (!orgId) return;
    setReading(true);
    try {
      const res = await readFn({
        data: { organizationId: orgId, clientId, fileName: file.name, fileBase64: await fileToBase64(file) },
      });
      setRead(res);
      setReview(initialReview(res.parse, res.carry));
      // The PDF is saved to the client's file right away.
      qc.invalidateQueries({ queryKey: ["client-docs", orgId, clientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read the PCSP.");
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!orgId || !read || !review) return;
    setSaving(true);
    try {
      const out = await confirmFn({ data: { organizationId: orgId, clientId, parseId: read.documentId, edits: review } });
      toast.success(`New plan year saved: ${out.goals} goal${out.goals === 1 ? "" : "s"}, ${out.supports} support${out.supports === 1 ? "" : "s"}, ${out.codes.length} authorization${out.codes.length === 1 ? "" : "s"}.`);
      try {
        await clockFn({ data: { organizationId: orgId, clientId } });
      } catch {
        /* The PCSP deadline clock must not block the import. */
      }
      const keys = [clientPlansKey(clientId), clientContactsKey(clientId), ["client-care-data", clientId], ["client-billing-codes"], ["client-active-codes"], ["client-budget"]];
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: key });
      }
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the plan.");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setRead(null);
    setReview(null);
  }

  return { reading, saving, read, review, setReview, upload, confirm, close };
}
