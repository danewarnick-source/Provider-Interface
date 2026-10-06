// The one editor for a rights restriction: the 8 required elements with
// their dates and whether it is still active. Opened from the client's
// Plans section; the Human Rights Committee page links there.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RESTRICTION_ELEMENTS,
  computeRestrictionCompletion,
  type RestrictionRecord,
} from "@/lib/clients/hrc";
import { writeClientRecord } from "@/lib/clients/writes.functions";

export function RestrictionDialog({
  record,
  clientName,
  canManage,
  orgId,
  onClose,
}: {
  record: RestrictionRecord;
  clientName: string;
  canManage: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const writeRecordFn = useServerFn(writeClientRecord);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of RESTRICTION_ELEMENTS) {
      init[def.textField as string] = (record[def.textField] as string | null) ?? "";
      if (def.dateField) init[def.dateField as string] = (record[def.dateField] as string | null) ?? "";
    }
    return init;
  });
  const [active, setActive] = useState(record.active);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string | boolean | null> = { active };
      for (const def of RESTRICTION_ELEMENTS) {
        patch[def.textField as string] = fields[def.textField as string]?.trim() || null;
        if (def.dateField) patch[def.dateField as string] = fields[def.dateField as string] || null;
      }
      await writeRecordFn({
        data: {
          organizationId: orgId,
          clientId: record.client_id,
          table: "hrc_restriction_records",
          op: "update",
          id: record.id,
          values: patch,
        },
      });
    },
    onSuccess: () => {
      toast.success("Restriction updated");
      qc.invalidateQueries({ queryKey: ["hrc-restrictions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-restrictions", record.client_id] });
      qc.invalidateQueries({ queryKey: ["client-overview"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewRecord: RestrictionRecord = { ...record, active };
  for (const def of RESTRICTION_ELEMENTS) {
    (previewRecord as unknown as Record<string, string | null>)[def.textField as string] =
      fields[def.textField as string] || null;
    if (def.dateField) {
      (previewRecord as unknown as Record<string, string | null>)[def.dateField as string] =
        fields[def.dateField as string] || null;
    }
  }
  const completion = computeRestrictionCompletion(previewRecord);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record.restriction_title} — {clientName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">
            {completion.isComplete ? "Fully documented" : "Incomplete documentation"}
          </span>
          <Badge
            variant={completion.isComplete ? "default" : "outline"}
            className={completion.isComplete ? "bg-emerald-600 hover:bg-emerald-600" : "border-amber-400 text-amber-800"}
          >
            {completion.completedCount}/{completion.total}
          </Badge>
        </div>
        <div className="space-y-4">
          {RESTRICTION_ELEMENTS.map((def) => {
            const isComplete = completion.elements.find((e) => e.def.key === def.key)?.complete ?? false;
            return (
              <div key={def.key} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-start gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      ({def.letter}) {def.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{def.description}</div>
                  </div>
                </div>
                <Textarea
                  disabled={!canManage}
                  rows={2}
                  value={fields[def.textField as string] ?? ""}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, [def.textField as string]: e.target.value }))
                  }
                  placeholder={`Describe ${def.label.toLowerCase()}…`}
                />
                {def.dateField && (
                  <div className="max-w-[220px] space-y-1">
                    <Label className="text-xs">{def.dateLabel}</Label>
                    <Input
                      disabled={!canManage}
                      type="date"
                      value={fields[def.dateField as string] ?? ""}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, [def.dateField as string]: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
          {canManage && (
            <div className="flex items-center gap-2">
              <Label htmlFor="restriction-active" className="text-sm">Restriction still active</Label>
              <input
                id="restriction-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canManage && (
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
