// The three states of the Support strategies card that don't edit content:
// nothing yet, an uploaded document, and the toolbar over a written draft.
// State and mutations live in support-strategies-panel.tsx.

import type { ReactNode } from "react";
import { formatDate } from "@/lib/clients/dates";
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/clients/profile/cards/section-card";

const PCSP_NOTE =
  "rounded-xl border border-hive-gold/50 bg-hive-gold-soft px-3 py-2 text-xs text-hive-ink";

function Spin({ on, icon }: { on: boolean; icon: ReactNode }) {
  return on ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <>{icon}</>;
}

/** Card description, with the due date until published. */
export function StrategiesDescription({ dueOn }: { dueOn: string | null }) {
  return (
    <>
      Each PCSP goal needs support strategies. Nectar pulls your goals word for word; you write the
      staff instructions.
      {dueOn ? (
        <span className="ml-1 font-medium text-hive-ink" data-testid="strategies-due">
          Due {formatDate(dueOn)}.
        </span>
      ) : null}
    </>
  );
}

export function StrategiesEmpty({
  pcspReady,
  drafting,
  uploading,
  onDraft,
  onUpload,
  fileInput,
}: {
  pcspReady: boolean;
  drafting: boolean;
  uploading: boolean;
  onDraft: (mode: "nectar" | "blank") => void;
  onUpload: () => void;
  fileInput: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {!pcspReady && (
        <div className={PCSP_NOTE}>
          Upload a PCSP to get started. Drafting is off until a PCSP is on file.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onDraft("nectar")} disabled={drafting}>
          <Spin on={drafting} icon={<Sparkles className="mr-1.5 h-3.5 w-3.5" />} />
          Build from PCSP goals with Nectar
        </Button>
        <Button variant="outline" onClick={() => onDraft("blank")} disabled={drafting}>
          Write strategies manually
        </Button>
        <Button variant="outline" onClick={onUpload} disabled={uploading}>
          <Spin on={uploading} icon={<Upload className="mr-1.5 h-3.5 w-3.5" />} />
          Upload document
        </Button>
        {fileInput}
      </div>
    </div>
  );
}

export function StrategiesUploaded({
  fileName,
  published,
  pcspReady,
  publishing,
  uploading,
  onPublish,
  onReplace,
  fileInput,
}: {
  fileName: string;
  published: boolean;
  pcspReady: boolean;
  publishing: boolean;
  uploading: boolean;
  onPublish: () => void;
  onReplace: () => void;
  fileInput: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">Uploaded provider document</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!published && (
          <Button onClick={onPublish} disabled={publishing}>
            <Spin on={publishing} icon={<CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />} />
            Approve and publish
          </Button>
        )}
        <Button variant="outline" onClick={onReplace} disabled={uploading}>
          <Spin on={uploading} icon={<Upload className="mr-1.5 h-3.5 w-3.5" />} />
          Replace document
        </Button>
        {fileInput}
      </div>
      {!pcspReady && (
        <p className="text-xs font-medium text-hive-ink">
          Upload a PCSP to get started. Publishing is off until a PCSP is on file.
        </p>
      )}
    </div>
  );
}

export function StrategiesToolbar({
  editing,
  published,
  rebuilding,
  publishing,
  saving,
  onEdit,
  onRebuild,
  onPublish,
  onCancel,
  onSave,
}: {
  editing: boolean;
  published: boolean;
  rebuilding: boolean;
  publishing: boolean;
  saving: boolean;
  onEdit: () => void;
  onRebuild: () => void;
  onPublish: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save strategies
        </Button>
      </>
    );
  }
  return (
    <>
      <Button variant="outline" onClick={onRebuild} disabled={rebuilding}>
        <Spin on={rebuilding} icon={<RefreshCw className="mr-1.5 h-3.5 w-3.5" />} />
        Rebuild from goals
      </Button>
      {!published && (
        <Button onClick={onPublish} disabled={publishing}>
          <Spin on={publishing} icon={<CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />} />
          Approve and publish
        </Button>
      )}
      <EditButton label="Edit support strategies" onClick={onEdit} />
    </>
  );
}
