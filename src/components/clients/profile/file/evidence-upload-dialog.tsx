// Add a file to a Client file row, through the Evidence path: the file goes
// to evidence-files storage and recordEvidenceUpload saves it on the item, so
// the Client file and Evidence show the same record. Earlier files stay on
// record. Rows that are confirmed rather than uploaded use
// recordEvidenceAttestation.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordEvidenceAttestation, recordEvidenceUpload } from "@/lib/evidence.functions";
import { requirementByKey } from "@/lib/evidence/catalog";
import type { ClientFileRow } from "@/lib/clients/file-rows";

export const EVIDENCE_BUCKET = "evidence-files";

export function EvidenceUploadDialog({
  orgId,
  row,
  onClose,
  onSaved,
}: {
  orgId: string;
  row: ClientFileRow & { itemId: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const uploadFn = useServerFn(recordEvidenceUpload);
  const attestFn = useServerFn(recordEvidenceAttestation);
  const [file, setFile] = useState<File | null>(null);
  const [expiresOn, setExpiresOn] = useState("");
  const [saving, setSaving] = useState(false);
  const confirmOnly = row.evidenceType === "attestation";
  const attestation =
    requirementByKey(row.key)?.attestationText ?? `${row.title} is done and on record.`;

  async function save() {
    setSaving(true);
    try {
      if (confirmOnly) {
        await attestFn({
          data: { organizationId: orgId, itemId: row.itemId, attestationText: attestation },
        });
      } else {
        if (!file) return;
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        const path = `${orgId}/${row.itemId}/${Date.now()}-${safe}`;
        const up = await supabase.storage
          .from(EVIDENCE_BUCKET)
          .upload(path, file, { upsert: true });
        if (up.error) throw new Error(up.error.message);
        await uploadFn({
          data: {
            organizationId: orgId,
            itemId: row.itemId,
            storagePath: path,
            filename: file.name,
            expiresOn: expiresOn || null,
          },
        });
      }
      toast.success(`${row.title} saved`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save it.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md" data-testid="client-file-upload-dialog">
        <DialogHeader>
          <DialogTitle>{confirmOnly ? `Confirm: ${row.title}` : `Upload ${row.title}`}</DialogTitle>
          <DialogDescription>
            {confirmOnly
              ? "Your name and today's date are saved with this confirmation."
              : row.file
                ? "The current file stays on record. The new one becomes current."
                : "Saved to this client's file and to Evidence."}
          </DialogDescription>
        </DialogHeader>
        {confirmOnly ? (
          <p className="rounded-xl border border-hive-border bg-[var(--hive-muted-surface)] p-3 text-sm">
            {attestation}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="client-file-input" className="text-xs">
                File
              </Label>
              <Input
                id="client-file-input"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client-file-expires" className="text-xs">
                Expires on (leave blank to use the usual renewal)
              </Label>
              <Input
                id="client-file-expires"
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || (!confirmOnly && !file)}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {confirmOnly ? "Confirm it's done" : `Upload ${row.title}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
