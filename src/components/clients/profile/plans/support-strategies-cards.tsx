// The parts of the Support strategies card around the list: the status line
// (in plain words, with the button that goes with it, coverage and the due
// date), the empty state and an uploaded strategies document. State and
// mutations live in support-strategies-panel.tsx.

import type { ReactNode } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { strategyStatusText, type StrategyStatus } from "@/lib/clients/support-strategies";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { StrategiesDocumentButton } from "./strategies-document-dialog";

const PCSP_NOTE =
  "rounded-xl border border-hive-gold/50 bg-hive-gold-soft px-3 py-2 text-xs text-hive-ink";

function Spin({ on, icon }: { on: boolean; icon: ReactNode }) {
  return on ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{icon}</>;
}

const TONE: Record<StrategyStatus["kind"], "profile" | "ok" | "danger"> = {
  draft: "profile",
  approved: "ok",
  outdated: "danger",
};

/**
 * "Draft: review and approve" + Approve, or "Out of date…" + Rebuild; coverage
 * and the due date beside it. Once approved: "View & download document".
 */
export function StrategiesStatus({
  clientId,
  status,
  covered,
  total,
  dueOn,
  canEdit,
  busy,
  onApprove,
  onRebuild,
}: {
  clientId: string;
  status: StrategyStatus;
  covered: number;
  total: number;
  dueOn: string | null;
  canEdit: boolean;
  busy: { approving: boolean; rebuilding: boolean };
  onApprove: () => void;
  onRebuild: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hive-border bg-[var(--hive-muted-surface)] px-3 py-2 text-sm max-md:[&_button]:min-h-11">
      <StatusTag tone={TONE[status.kind]} testId="strategies-status">
        {strategyStatusText(status)}
      </StatusTag>
      {total > 0 ? (
        <span className="text-xs text-muted-foreground" data-testid="strategies-coverage">
          {covered} of {total} supports have a strategy
        </span>
      ) : null}
      {dueOn && status.kind !== "approved" ? (
        <span className="text-xs font-medium text-hive-ink" data-testid="strategies-due">
          Due to the support coordinator by {formatDate(dueOn)}
        </span>
      ) : null}
      {canEdit ? (
        <span className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRebuild} disabled={busy.rebuilding}>
            <Spin on={busy.rebuilding} icon={<RefreshCw className="h-4 w-4" />} />
            Rebuild from PCSP supports
          </Button>
          {status.kind === "draft" ? (
            <Button onClick={onApprove} disabled={busy.approving}>
              <Spin on={busy.approving} icon={<CheckCircle2 className="h-4 w-4" />} />
              Approve
            </Button>
          ) : null}
          {status.kind === "approved" ? <StrategiesDocumentButton clientId={clientId} /> : null}
        </span>
      ) : null}
    </div>
  );
}

export function StrategiesEmpty({
  pcspReady,
  supportCount,
  drafting,
  uploading,
  onDraft,
  onUpload,
  fileInput,
}: {
  pcspReady: boolean;
  supportCount: number;
  drafting: boolean;
  uploading: boolean;
  onDraft: (mode: "nectar" | "blank") => void;
  onUpload: () => void;
  fileInput: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className={PCSP_NOTE}>
        {!pcspReady
          ? "Upload the PCSP first. Strategies are written for each of its supports paid to the agency."
          : supportCount === 0
            ? "No support in the current plan year has one of the agency's codes, so no strategy is needed yet."
            : `${supportCount} support${supportCount === 1 ? "" : "s"} paid to the agency need a strategy.`}
      </div>
      <div className="flex flex-wrap gap-2 max-md:[&_button]:min-h-11">
        <Button onClick={() => onDraft("nectar")} disabled={drafting}>
          <Spin on={drafting} icon={<Sparkles className="h-4 w-4" />} />
          Draft strategies with Nectar
        </Button>
        <Button variant="outline" onClick={() => onDraft("blank")} disabled={drafting}>
          Write strategies by hand
        </Button>
        <Button variant="outline" onClick={onUpload} disabled={uploading}>
          <Spin on={uploading} icon={<Upload className="h-4 w-4" />} />
          Upload strategies document
        </Button>
        {fileInput}
      </div>
    </div>
  );
}

export function StrategiesUploaded({
  fileName,
  published,
  publishing,
  uploading,
  onPublish,
  onReplace,
  fileInput,
}: {
  fileName: string;
  published: boolean;
  publishing: boolean;
  uploading: boolean;
  onPublish: () => void;
  onReplace: () => void;
  fileInput: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-hive-border bg-[var(--hive-muted-surface)] p-3 text-sm">
        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">Uploaded strategies document</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 max-md:[&_button]:min-h-11">
        {!published && (
          <Button onClick={onPublish} disabled={publishing}>
            <Spin on={publishing} icon={<CheckCircle2 className="h-4 w-4" />} />
            Approve
          </Button>
        )}
        <Button variant="outline" onClick={onReplace} disabled={uploading}>
          <Spin on={uploading} icon={<Upload className="h-4 w-4" />} />
          Replace document
        </Button>
        {fileInput}
      </div>
    </div>
  );
}
