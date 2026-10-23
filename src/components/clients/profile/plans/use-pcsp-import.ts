// Upload PCSP in Plans: upload the PDF to the client's folder → read it →
// hold the editable review → confirm. Nothing about the plan is written until
// confirm(). A failed read and the saved result stay on screen (outcome).
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { confirmPcsp, readPcsp, type PcspRead } from "@/lib/clients/pcsp/import.functions";
import { filedReport, pcspFolder, readFailure, savedReport } from "@/lib/clients/pcsp/read-report";
import { initialReview, type ReviewedPcsp } from "@/lib/clients/pcsp/review";
import { onPcspActivated } from "@/lib/company-obligations.functions";
import { clientPlansKey } from "@/components/clients/shared/hooks/use-plan-goals";
import { clientContactsKey } from "@/components/clients/shared/hooks/use-client-contacts";
import { uploadPcspFile } from "@/components/clients/shared/upload-pcsp";
import { clientFileKey } from "@/components/clients/profile/file/use-client-file";
import { clientProfileKey } from "@/components/clients/profile/use-client-profile";

/** What happened, kept on screen until closed. */
export type PcspOutcome =
  | { kind: "failed"; message: string }
  | { kind: "saved"; lines: string[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function usePcspImport(clientId: string, orgId: string | undefined) {
  const qc = useQueryClient();
  const readFn = useServerFn(readPcsp);
  const confirmFn = useServerFn(confirmPcsp);
  const clockFn = useServerFn(onPcspActivated);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [read, setRead] = useState<PcspRead | null>(null);
  const [review, setReview] = useState<ReviewedPcsp | null>(null);
  const [outcome, setOutcome] = useState<PcspOutcome | null>(null);
  /** Why Confirm failed; shown in the review, which stays open. */
  const [saveError, setSaveError] = useState<string | null>(null);

  async function upload(picked: File) {
    if (!orgId) return;
    setFile(picked);
    setOutcome(null);
    setReading(true);
    try {
      const storagePath = await uploadPcspFile(pcspFolder(orgId, clientId), picked);
      const res = await readFn({ data: { organizationId: orgId, clientId, fileName: picked.name, storagePath } });
      if (!res.ok) {
        setOutcome({ kind: "failed", message: res.message });
        return;
      }
      setRead(res.read);
      setReview(initialReview(res.read.parse, res.read.carry));
      // The PDF is saved to the client's documents right away.
      qc.invalidateQueries({ queryKey: ["client-docs", orgId, clientId] });
    } catch (e) {
      setOutcome({ kind: "failed", message: readFailure(message(e)) });
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!orgId || !read || !review) return;
    setSaving(true);
    setSaveError(null);
    try {
      const out = await confirmFn({ data: { organizationId: orgId, clientId, parseId: read.documentId, edits: review } });
      setOutcome({ kind: "saved", lines: [savedReport(out, review.plan), filedReport(out.filed)] });
      try {
        await clockFn({ data: { organizationId: orgId, clientId } });
      } catch {
        /* The PCSP deadline clock must not block the import. */
      }
      const keys = [
        clientPlansKey(clientId), clientContactsKey(clientId), ["client-care-data", clientId], ["client-billing-codes"],
        ["client-active-codes"], ["client-budget"], clientFileKey(clientId), clientProfileKey(orgId, clientId),
        ["client-overview"],
      ];
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
      close();
    } catch (e) {
      setSaveError(`Couldn't save the plan: ${message(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setRead(null);
    setReview(null);
    setSaveError(null);
  }

  return {
    reading, saving, saveError, read, review, setReview, upload, confirm, close, outcome,
    retry: () => (file ? void upload(file) : undefined),
    dismiss: () => setOutcome(null),
  };
}
