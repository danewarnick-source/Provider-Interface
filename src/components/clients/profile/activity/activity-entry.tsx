// One timeline entry: type tag, date, author, code and a preview. Office
// notes carry the lock. The whole row opens the record in the side panel.

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { formatDate } from "@/lib/clients/dates";
import { ACTIVITY_KIND_LABELS, type ActivityEntry, type ActivityKind } from "@/lib/clients/activity";

const TONE: Record<ActivityKind, "info" | "ok" | "danger" | "neutral"> = {
  shift: "info",
  daily_log: "ok",
  incident: "danger",
  office_note: "neutral",
};
const DOT: Record<ActivityKind, string> = {
  shift: "bg-[var(--hive-info)]",
  daily_log: "bg-[var(--hive-ok)]",
  incident: "bg-[var(--hive-danger)]",
  office_note: "bg-hive-ink",
};

export function ActivityEntryRow({
  entry: e,
  author,
  onOpen,
}: {
  entry: ActivityEntry;
  author: string | null;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-w-0 gap-3 rounded-xl px-2 py-3 text-left hover:bg-[var(--hive-muted-surface)]/60"
        data-testid="client-activity-entry"
      >
        <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[e.kind])} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <StatusTag tone={TONE[e.kind]}>
              {e.officeOnly ? <Lock className="h-3 w-3" aria-label="Office only" /> : null}
              {ACTIVITY_KIND_LABELS[e.kind]}
            </StatusTag>
            <span className="font-medium text-hive-ink">{formatDate(e.at)}</span>
            {author ? <span className="text-muted-foreground">{author}</span> : null}
            {e.code ? <span className="font-mono text-xs text-muted-foreground">{e.code}</span> : null}
          </span>
          {e.preview ? (
            <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{e.preview}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
