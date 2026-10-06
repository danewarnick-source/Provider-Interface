// Human Rights / HRC on the client (Plans section until it is rebuilt):
// "any rights restrictions?" toggle, the 8-element restriction form and the
// signed HRC document.

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  RESTRICTION_ELEMENTS,
  computeRestrictionCompletion,
  type RestrictionRecord,
} from "@/lib/clients/hrc";
import { updateClient, writeClientRecord } from "@/lib/clients/writes.functions";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { HexMarker } from "./card-shell";
import type { DocRow } from "./code-document-cards";

const HRR_FILENAME_RE = /hrr|hrc|human[\s_-]*rights|rights[\s_-]*restriction/i;

export function HrcCard({
  clientId,
  orgId,
  hasRestrictions,
  docs,
  restriction,
}: {
  clientId: string;
  orgId: string;
  hasRestrictions: boolean;
  docs: DocRow[];
  restriction: RestrictionRecord | null;
}) {
  const qc = useQueryClient();
  const updateClientFn = useServerFn(updateClient);
  const writeRecordFn = useServerFn(writeClientRecord);
  const canEditHrc = useAccess().canCategory("hrc", "edit");
  const hrrDoc = docs.find(
    (d) =>
      d.document_type === "hrc_approval" ||
      d.document_type === "human_rights" ||
      (d.file_name ? HRR_FILENAME_RE.test(d.file_name) : false),
  );

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of RESTRICTION_ELEMENTS) {
      init[def.textField as string] = (restriction?.[def.textField] as string | null) ?? "";
      if (def.dateField)
        init[def.dateField as string] = (restriction?.[def.dateField] as string | null) ?? "";
    }
    return init;
  });
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const def of RESTRICTION_ELEMENTS) {
      init[def.textField as string] = (restriction?.[def.textField] as string | null) ?? "";
      if (def.dateField)
        init[def.dateField as string] = (restriction?.[def.dateField] as string | null) ?? "";
    }
    setFields(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restriction?.id]);

  const toggleMutation = useMutation({
    mutationFn: async (value: boolean) => {
      await updateClientFn({
        data: { organizationId: orgId, clientId, patch: { hr_applicable: value } },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string | boolean | null> = { active: true };
      for (const def of RESTRICTION_ELEMENTS) {
        patch[def.textField as string] = fields[def.textField as string]?.trim() || null;
        if (def.dateField) patch[def.dateField as string] = fields[def.dateField as string] || null;
      }
      if (restriction) {
        await writeRecordFn({
          data: {
            organizationId: orgId,
            clientId,
            table: "hrc_restriction_records",
            op: "update",
            id: restriction.id,
            values: patch,
          },
        });
      } else {
        await writeRecordFn({
          data: {
            organizationId: orgId,
            clientId,
            table: "hrc_restriction_records",
            op: "insert",
            values: { restriction_title: "Rights restriction", ...patch },
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("HRC record saved.");
      qc.invalidateQueries({ queryKey: ["client-restrictions", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewRecord = { ...(restriction ?? {}) } as RestrictionRecord;
  for (const def of RESTRICTION_ELEMENTS) {
    (previewRecord as unknown as Record<string, string | null>)[def.textField as string] =
      fields[def.textField as string] || null;
    if (def.dateField)
      (previewRecord as unknown as Record<string, string | null>)[def.dateField as string] =
        fields[def.dateField as string] || null;
  }
  const completion = computeRestrictionCompletion(previewRecord);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Human Rights / HRC</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              SOW §1.20 rights-restriction documentation
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
            <span className="text-sm font-medium">
              Does this client have any rights restrictions?
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className={!hasRestrictions ? "font-semibold" : "text-muted-foreground"}>
                No
              </span>
              <Switch
                checked={hasRestrictions}
                disabled={!canEditHrc}
                onCheckedChange={(v) => toggleMutation.mutate(v)}
              />
              <span className={hasRestrictions ? "font-semibold" : "text-muted-foreground"}>
                Yes
              </span>
            </div>
          </label>

          {!hasRestrictions ? (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50/40 p-3 text-sm text-emerald-800">
              No restrictions — this section is satisfied.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  8-element restriction form
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    completion.isComplete
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {completion.completedCount}/{completion.total} complete
                </span>
              </div>
              {RESTRICTION_ELEMENTS.map((def) => (
                <div key={def.key} className="space-y-1">
                  <Label className="text-xs">
                    {def.letter}) {def.label}
                  </Label>
                  <Textarea
                    value={fields[def.textField as string] ?? ""}
                    onChange={(e) =>
                      setFields((f) => ({ ...f, [def.textField as string]: e.target.value }))
                    }
                    placeholder={def.description}
                    rows={2}
                  />
                  {def.dateField ? (
                    <Input
                      type="date"
                      className="w-44"
                      value={fields[def.dateField as string] ?? ""}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, [def.dateField as string]: e.target.value }))
                      }
                    />
                  ) : null}
                </div>
              ))}
              <div className="flex justify-end">
                {canEditHrc && (
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "Saving…" : "Save restriction form"}
                  </Button>
                )}
              </div>

              <div className="pt-2 border-t border-border/60">
                <Label className="text-xs">
                  HRC restriction document — requires staff, coordinator, and client signatures
                </Label>
                {hrrDoc ? (
                  <NectarAsk
                    question="HRC restriction document — requires staff, coordinator, and client signatures"
                    kind="data_rich_gap"
                    clientId={clientId}
                    uploadDocumentType="hrc_approval"
                    answeredSummary={`On file: ${hrrDoc.file_name ?? "signed document"}`}
                  />
                ) : (
                  <NectarAsk
                    question="Upload the signed HRC restriction document (staff, coordinator, and client signatures)"
                    kind="data_rich_gap"
                    clientId={clientId}
                    uploadDocumentType="hrc_approval"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
