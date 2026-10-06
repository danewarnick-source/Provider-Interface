// One activity record, opened from its row: labelled facts and the full text.

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type RecordFact = { label: string; value: ReactNode };

export function RecordDialog({
  open,
  onOpenChange,
  title,
  facts,
  body,
  bodyLabel,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  facts: RecordFact[];
  body?: string | null;
  bodyLabel?: string;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="activity-record">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Record details</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="break-words">{f.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {bodyLabel ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{bodyLabel}</p>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
              {body?.trim() || "—"}
            </p>
          </div>
        ) : null}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
