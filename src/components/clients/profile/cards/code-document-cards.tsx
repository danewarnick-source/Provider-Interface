// Documents some codes require: ELS school documentation (under 22) and the
// EPR informed-choice conversation (60 days from EPR start). Shown in the
// Client file section.

import { GraduationCap, Handshake } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { cn } from "@/lib/utils";
import { formatDate, parseLocalDate } from "@/lib/clients/dates";
import { SectionCard } from "./section-card";
import { deadlineToneClass } from "./deadline-banner";

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
    <SectionCard
      icon={GraduationCap}
      tone="info"
      title="Extended Living Supports: school documentation"
      description="ELS for school age (under 22). No expiration, just present or missing."
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs">School district documentation — shortened school hours</Label>
          {hoursDoc ? (
            <NectarAsk
              question="School district documentation — shortened school hours"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="els_shortened_school_hours"
              answeredSummary={`On file since ${formatDate(hoursDoc.uploaded_at)} — ${hoursDoc.file_name ?? "document"}`}
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
              answeredSummary={`On file since ${formatDate(iepDoc.uploaded_at)} — ${iepDoc.file_name ?? "document"}`}
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
    </SectionCard>
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
    <SectionCard
      icon={Handshake}
      tone="info"
      title="EPR informed choice conversation"
      description="Confirms EPR is not permanent, their employment goals, and a plan for after EPR ends."
    >
      <div className="space-y-3">
        {dueStr ? (
          <div
            className={cn(
              "rounded-xl border p-3 text-sm font-medium",
              deadlineToneClass(!!doc, isOverdue),
            )}
          >
            {doc
              ? `Satisfied — deadline was ${formatDate(dueStr)}`
              : isOverdue
                ? `Overdue — was due ${formatDate(dueStr)} (60 days from EPR start)`
                : `Due ${formatDate(dueStr)} — 60 days from EPR service start`}
          </div>
        ) : (
          <div className="rounded-xl border border-hive-border p-3 text-sm text-muted-foreground">
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
            answeredSummary={`On file since ${formatDate(doc.uploaded_at)} — ${doc.file_name ?? "document"}`}
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
    </SectionCard>
  );
}
