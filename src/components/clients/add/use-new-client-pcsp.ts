// Add client's PCSP: upload the PDF once to the org's new-client folder, read
// it, hold the review, then save the client and the plan in one call
// (addClientFromPcsp). A failed read and the saved result stay on screen.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgencySetupStatus } from "@/lib/agency-setup-gate.functions";
import { assertAgencySetupComplete } from "@/lib/agency-setup-gate";
import { onPcspActivated } from "@/lib/company-obligations.functions";
import {
  addClientFromPcsp,
  readPcspForNewClient,
  type AddFromPcspResult,
} from "@/lib/clients/create-from-pcsp.functions";
import type { AddClientForm } from "@/lib/clients/create";
import type { PcspRead } from "@/lib/clients/pcsp/import.functions";
import { newClientPcspFolder, readFailure } from "@/lib/clients/pcsp/read-report";
import { initialReview, type ReviewedPcsp } from "@/lib/clients/pcsp/review";
import { uploadPcspFile } from "@/components/clients/shared/upload-pcsp";

export type NewClientSaved = Extract<AddFromPcspResult, { status: "created" }>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useNewClientPcsp(organizationId: string) {
  const qc = useQueryClient();
  const readFn = useServerFn(readPcspForNewClient);
  const saveFn = useServerFn(addClientFromPcsp);
  const loadSetup = useServerFn(getAgencySetupStatus);
  const clockFn = useServerFn(onPcspActivated);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [read, setRead] = useState<PcspRead | null>(null);
  const [review, setReview] = useState<ReviewedPcsp | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Upload and read; the read (or null when it failed — `failed` says why). */
  async function pick(picked: File): Promise<PcspRead | null> {
    setFile(picked);
    setFailed(null);
    setReading(true);
    try {
      const storagePath = await uploadPcspFile(newClientPcspFolder(organizationId), picked);
      const res = await readFn({ data: { organizationId, fileName: picked.name, storagePath } });
      if (!res.ok) {
        setFailed(res.message);
        return null;
      }
      setRead(res.read);
      setReview(initialReview(res.read.parse, res.read.carry));
      return res.read;
    } catch (e) {
      setFailed(readFailure(message(e)));
      return null;
    } finally {
      setReading(false);
    }
  }

  /** Save the client and the reviewed plan. Returns the server's answer (null on a thrown error). */
  async function save(form: AddClientForm): Promise<AddFromPcspResult | null> {
    if (!read || !review) return null;
    setSaving(true);
    setSaveError(null);
    try {
      assertAgencySetupComplete(await loadSetup({ data: { organizationId } }));
      const res = await saveFn({
        data: { organizationId, fileName: read.fileName, storagePath: read.storagePath, form, review },
      });
      if (res.status === "invalid") setSaveError(`Please complete: ${res.problems.join(", ")}.`);
      if (res.status === "created") {
        void qc.invalidateQueries({ queryKey: ["clients"] });
        if (res.plan.ok) {
          try {
            await clockFn({ data: { organizationId, clientId: res.id } });
          } catch {
            /* The PCSP deadline clock must not block the save. */
          }
        }
      }
      return res;
    } catch (e) {
      setSaveError(`Couldn't save: ${message(e)}`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setFile(null);
    setFailed(null);
    setRead(null);
    setReview(null);
    setSaveError(null);
  }

  return {
    reading, failed, read, review, setReview, saving, saveError, pick, save, reset,
    retry: () => (file ? pick(file) : Promise.resolve(null)),
  };
}
