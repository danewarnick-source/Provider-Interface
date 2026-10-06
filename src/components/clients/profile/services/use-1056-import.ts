// Upload a 1056 → Nectar reads it (every value quoted from the PDF) → hold
// the editable review → confirm. Authorizations are written only on confirm.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirm1056, read1056, type Read1056Result } from "@/lib/clients/budget-parse.functions";
import { initial1056Review, type Review1056 } from "@/lib/clients/auth-1056";
import { fileToBase64 } from "@/components/clients/shared/file-to-base64";

export function use1056Import(orgId: string, clientId: string, onSaved: () => void) {
  const qc = useQueryClient();
  const readFn = useServerFn(read1056);
  const confirmFn = useServerFn(confirm1056);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [read, setRead] = useState<Read1056Result | null>(null);
  const [review, setReview] = useState<Review1056 | null>(null);

  async function upload(file: File) {
    setReading(true);
    try {
      const res = await readFn({
        data: {
          organizationId: orgId,
          clientId,
          fileName: file.name,
          fileBase64: await fileToBase64(file),
        },
      });
      setRead(res);
      setReview(initial1056Review(res.read, res.agencyCodes));
      // The PDF is in the client's file right away.
      void qc.invalidateQueries({ queryKey: ["client-docs", orgId, clientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read the 1056.");
    } finally {
      setReading(false);
    }
  }

  async function confirm() {
    if (!read || !review) return;
    setSaving(true);
    try {
      const out = await confirmFn({
        data: { organizationId: orgId, clientId, documentId: read.documentId, review },
      });
      toast.success(
        `Saved ${out.codes.length} authorization${out.codes.length === 1 ? "" : "s"} from the 1056.`,
      );
      onSaved();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the authorizations.");
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
