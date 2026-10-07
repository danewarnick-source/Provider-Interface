// Upload a required document, or replace the one on file (the old one is
// kept as outdated). Yearly documents get an expiry a year out, which can
// be changed.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { todayYmd } from "@/lib/clients/dates";
import { suggestedExpiry, type RequiredDocRow } from "@/lib/clients/file-required";
import { uploadClientFileDocument } from "@/lib/clients/file-documents.functions";
import { fileToBase64 } from "@/components/clients/shared/file-to-base64";

export function DocumentUploadDialog({
  orgId,
  clientId,
  row,
  onClose,
  onSaved,
}: {
  orgId: string;
  clientId: string;
  row: RequiredDocRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const uploadFn = useServerFn(uploadClientFileDocument);
  const [file, setFile] = useState<File | null>(null);
  const [expiresOn, setExpiresOn] = useState(
    () => suggestedExpiry(row.docType ?? "", todayYmd()) ?? "",
  );
  const [saving, setSaving] = useState(false);
  const replacing = !!row.current?.id;

  async function save() {
    if (!file || !row.docType) return;
    setSaving(true);
    try {
      await uploadFn({
        data: {
          organizationId: orgId,
          clientId,
          documentType: row.docType,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64: await fileToBase64(file),
          expiresOn: expiresOn || null,
          replacesId: row.current?.id ?? null,
        },
      });
      toast.success(`${row.label} ${replacing ? "replaced" : "uploaded"}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't upload the document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md" data-testid="document-upload-dialog">
        <DialogHeader>
          <DialogTitle>
            {replacing ? "Replace" : "Upload"} {row.label.toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {replacing
              ? "The current file stays in the record as outdated."
              : "Saved to this client's file."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="doc-file" className="text-xs">
              File
            </Label>
            <Input
              id="doc-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-expires" className="text-xs">
              Expires on {row.yearly ? "(renewed yearly)" : "(leave blank if it doesn't expire)"}
            </Label>
            <Input
              id="doc-expires"
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !file}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {replacing ? "Replace file" : "Upload file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
