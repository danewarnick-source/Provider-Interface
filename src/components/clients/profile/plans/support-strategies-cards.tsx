// The three states of the Support strategies card that don't edit content:
// nothing yet, an uploaded document, and the toolbar over a written draft.
// State and mutations live in support-strategies-panel.tsx.

import type { ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";

const PCSP_NOTE =
  "rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900";

function Spin({ on, icon }: { on: boolean; icon: ReactNode }) {
  return on ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <>{icon}</>;
}

/** Collapsible card title row. */
export function StrategiesTitle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Collapse" : "Expand"}
        className="rounded p-1 hover:bg-muted"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <CardTitle className="text-base">Support strategies</CardTitle>
    </div>
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
      <p className="text-sm text-muted-foreground">
        Each PCSP goal needs support strategies. Nectar pulls your goals word for word; you write
        the staff instructions.
      </p>
      {!pcspReady && (
        <div className={PCSP_NOTE}>
          Upload a PCSP to get started. Drafting is off until a PCSP is on file.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onDraft("nectar")} disabled={drafting}>
          <Spin on={drafting} icon={<Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />} />
          Build from PCSP goals (Nectar)
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDraft("blank")} disabled={drafting}>
          Write manually
        </Button>
        <Button size="sm" variant="outline" onClick={onUpload} disabled={uploading}>
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
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">Uploaded provider document</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!published && (
          <Button size="sm" onClick={onPublish} disabled={publishing}>
            <Spin on={publishing} icon={<CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />} />
            Approve & Publish
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onReplace} disabled={uploading}>
          <Spin on={uploading} icon={<Upload className="mr-1.5 h-3.5 w-3.5" />} />
          Replace
        </Button>
        {fileInput}
      </div>
      {!pcspReady && (
        <p className="text-xs text-amber-700">
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
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={onRebuild} disabled={rebuilding}>
        <Spin on={rebuilding} icon={<RefreshCw className="mr-1.5 h-3.5 w-3.5" />} />
        Rebuild from goals
      </Button>
      {!published && (
        <Button size="sm" onClick={onPublish} disabled={publishing}>
          <Spin on={publishing} icon={<CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />} />
          Approve & Publish
        </Button>
      )}
    </>
  );
}
