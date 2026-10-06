// Documents some codes require: ELS school documentation (under 22) and the
// EPR informed-choice conversation (60 days from EPR start). Shown in the
// Client file section.

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/clients/dates";
import { HexMarker, fmtDate } from "./card-shell";

export type DocRow = {
  id: string;
  document_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
};

// ── ELS — Extended Living Supports school documentation (under 22) ─────────

export function ElsSchoolDocumentationCard({
  clientId,
  docs,
}: {
  clientId: string;
  docs: DocRow[];
}) {
  const hoursDoc = docs.find((d) => d.document_type === "els_shortened_school_hours");
  const iepDoc = docs.find((d) => d.document_type === "els_iep");
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">
              Extended Living Supports — School Documentation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ELS · school-age (under 22) — no expiration, just present or missing
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs">
              School district documentation — shortened school hours
            </Label>
            {hoursDoc ? (
              <NectarAsk
                question="School district documentation — shortened school hours"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_shortened_school_hours"
                answeredSummary={`On file since ${fmtDate(hoursDoc.uploaded_at)} — ${hoursDoc.file_name ?? "document"}`}
              />
            ) : (
              <NectarAsk
                question="Upload the school district letter/form confirming shortened school hours"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_shortened_school_hours"
              />
            )}
          </div>
          <div>
            <Label className="text-xs">Individualized Education Plan (IEP)</Label>
            {iepDoc ? (
              <NectarAsk
                question="Individualized Education Plan (IEP)"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_iep"
                answeredSummary={`On file since ${fmtDate(iepDoc.uploaded_at)} — ${iepDoc.file_name ?? "document"}`}
              />
            ) : (
              <NectarAsk
                question="Upload the Individualized Education Plan (IEP)"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_iep"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── EPR — Informed Choice conversation documentation (60-day deadline) ─────

export function EprInformedChoiceCard({
  clientId,
  docs,
  serviceStart,
}: {
  clientId: string;
  docs: DocRow[];
  serviceStart: string | null;
}) {
  const doc = docs.find((d) => d.document_type === "epr_informed_choice");
  const serviceStartDate = parseLocalDate(serviceStart);
  const dueDate = serviceStartDate ? new Date(serviceStartDate.getTime() + 60 * 86_400_000) : null;
  const dueStr = dueDate ? dueDate.toISOString().slice(0, 10) : null;
  const isOverdue = !doc && !!dueDate && dueDate.getTime() < Date.now();
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">
              EPR Informed Choice Conversation — Documentation
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Must confirm EPR is not permanent, the Person's employment goals, and a plan for after
              EPR ends.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {dueStr ? (
            <div
              className={cn(
                "rounded-md border p-2.5 text-sm font-medium",
                doc
                  ? "border-emerald-300/60 bg-emerald-50/40 text-emerald-800"
                  : isOverdue
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-amber-300/60 bg-amber-50/40 text-amber-800",
              )}
            >
              {doc
                ? `Satisfied — deadline was ${fmtDate(dueStr)}`
                : isOverdue
                  ? `Overdue — was due ${fmtDate(dueStr)} (60 days from EPR start)`
                  : `Due ${fmtDate(dueStr)} — 60 days from EPR service start`}
            </div>
          ) : (
            <div className="rounded-md border border-border p-2.5 text-sm text-muted-foreground">
              No EPR service start date on file — set the EPR authorization's start date to compute
              the deadline.
            </div>
          )}
          {doc ? (
            <NectarAsk
              question="EPR Informed Choice Conversation — Documentation"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="epr_informed_choice"
              answeredSummary={`On file since ${fmtDate(doc.uploaded_at)} — ${doc.file_name ?? "document"}`}
            />
          ) : (
            <NectarAsk
              question="Upload the written Informed Choice conversation document"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="epr_informed_choice"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
