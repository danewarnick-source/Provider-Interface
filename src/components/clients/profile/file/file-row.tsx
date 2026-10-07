// One Client file row: title and why on the left (with a small § hint when
// the SOW section is confirmed), status and the row's button on the right.
// The ⋯ menu marks it "Not needed for this client" or undoes that.

import { CheckCircle2, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import type { CardTone } from "@/components/clients/profile/cards/section-card";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";
import { isAutoReason } from "@/lib/clients/file-packs";
import type { ClientFileRow, ClientFileRowState } from "@/lib/clients/file-rows";

const TONE: Record<ClientFileRowState, CardTone> = {
  on_file: "ok",
  due_soon: "profile",
  missing: "danger",
  awaiting_review: "info",
  sent_back: "danger",
  not_needed: "neutral",
  optional: "neutral",
};

const UPLOAD_LABEL: Record<string, string> = {
  copy_1056: "Upload a copy of the 1056 (optional)",
};

function uploadLabel(row: ClientFileRow): string {
  if (row.file) return "Replace file";
  return (
    UPLOAD_LABEL[row.key] ?? `Upload ${row.title.charAt(0).toLowerCase()}${row.title.slice(1)}`
  );
}

export function FileRow({
  row,
  canEdit,
  canManage,
  onUpload,
  onOpenFile,
  onOpenSection,
  onNotNeeded,
  onUndo,
}: {
  row: ClientFileRow;
  /** Clients edit: upload and confirm. */
  canEdit: boolean;
  /** Owners / agency admins: mark not needed and undo. */
  canManage: boolean;
  onUpload: (row: ClientFileRow & { itemId: string }) => void;
  onOpenFile: (path: string) => void;
  onOpenSection: (section: ClientProfileSection) => void;
  onNotNeeded: (row: ClientFileRow & { itemId: string }) => void;
  onUndo: (itemId: string) => void;
}) {
  const waived = row.state === "not_needed";
  const itemId = row.itemId;
  const canFill = canEdit && !!itemId && !waived && !row.keptIn && !row.keptHere;
  return (
    <li
      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
      data-testid="client-file-row"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-hive-ink">{row.title}</p>
        {row.why ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {row.why}
            {row.sowHint ? <span className="ml-1 text-xs">({row.sowHint})</span> : null}
          </p>
        ) : null}
        {row.file?.filename && !waived ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{row.file.filename}</p>
        ) : null}
        {row.keptHere && !waived ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Kept in the belongings inventory below.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <StatusTag tone={TONE[row.state]} testId="client-file-row-status">
          {row.label}
        </StatusTag>
        {row.file?.path && (
          <Button variant="outline" onClick={() => onOpenFile(row.file!.path!)}>
            <Eye className="h-4 w-4" />
            Open file
          </Button>
        )}
        {row.keptIn && !waived && (
          <Button variant="outline" onClick={() => onOpenSection(row.keptIn!)}>
            Open {CLIENT_SECTION_LABEL[row.keptIn]}
          </Button>
        )}
        {canFill && (
          <Button
            variant={row.state === "missing" ? "default" : "outline"}
            onClick={() => onUpload({ ...row, itemId: itemId! })}
          >
            {row.evidenceType === "attestation" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {row.evidenceType === "attestation" ? "Confirm it's done" : uploadLabel(row)}
          </Button>
        )}
        {canManage && itemId ? (
          <RowMenu
            label={`More actions for ${row.title}`}
            items={[
              !waived && {
                label: "Not needed for this client",
                onSelect: () => onNotNeeded({ ...row, itemId }),
              },
              waived &&
                !isAutoReason(row.reason) && {
                  label: "Undo: needed again",
                  onSelect: () => onUndo(itemId),
                },
            ]}
          />
        ) : null}
      </div>
    </li>
  );
}
