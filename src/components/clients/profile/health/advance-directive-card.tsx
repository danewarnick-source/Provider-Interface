// Advance directive: None / DNR / POLST, where the paper is kept, notes,
// and palliative care / hospice folded in. DNR or POLST makes the signed
// document required in the client file (dnr_applicable follows the status).

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIRECTIVE_OPTIONS,
  directiveLabel,
  directivePatch,
  directiveStatus,
  type DirectiveDraft,
  type DirectiveStatus,
} from "@/lib/clients/health";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid, LabeledInput } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

export function AdvanceDirectiveCard({
  orgId,
  health,
}: {
  orgId: string;
  health: ClientHealthRow;
}) {
  const save = useSaveHealth(orgId, health.id, () => setDraft(null));
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<DirectiveDraft | null>(null);
  const status = directiveStatus(health.dnr_status) ?? (health.polst_status ? "polst" : null);
  const set = (patch: Partial<DirectiveDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  return (
    <SectionCard
      icon={FileSignature}
      tone="danger"
      title="Advance directive"
      description="DNR or POLST, where the signed form is kept, palliative care and hospice."
      actions={
        canEdit && draft === null ? (
          <EditButton
            label="Edit advance directive"
            onClick={() =>
              setDraft({
                status: status ?? "none",
                location: health.dnr_location ?? "",
                palliative: health.palliative_care_status ?? "",
                hospice: health.hospice_status ?? "",
                notes: health.advance_directive_notes ?? "",
              })
            }
          />
        ) : null
      }
    >
      {draft ? (
        <div className="grid gap-3" data-testid="advance-directive-form">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => set({ status: v as DirectiveStatus })}
            >
              <SelectTrigger aria-label="Directive status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIVE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.status !== "none" ? (
            <LabeledInput
              label="Where the signed form is kept"
              value={draft.location}
              onChange={(v) => set({ location: v })}
            />
          ) : null}
          <LabeledInput
            label="Palliative care"
            value={draft.palliative}
            onChange={(v) => set({ palliative: v })}
          />
          <LabeledInput
            label="Hospice"
            value={draft.hospice}
            onChange={(v) => set({ hospice: v })}
          />
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div data-testid="advance-directive">
          <FieldGrid>
            <Field label="Status">{directiveLabel(status)}</Field>
            {status && status !== "none" ? (
              <Field label="Kept at">{health.dnr_location || null}</Field>
            ) : null}
            <Field label="Palliative care">{health.palliative_care_status || null}</Field>
            <Field label="Hospice">{health.hospice_status || null}</Field>
          </FieldGrid>
          {health.advance_directive_notes ? (
            <p className="whitespace-pre-wrap pt-2 text-sm">{health.advance_directive_notes}</p>
          ) : null}
          {status && status !== "none" ? (
            <p className="pt-2 text-xs text-muted-foreground">
              Upload the signed {directiveLabel(status)} form in the Client file.
            </p>
          ) : null}
        </div>
      )}
      {draft ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          saving={save.isPending}
          saveLabel="Save advance directive"
          onSave={() => save.mutate(directivePatch(draft))}
        />
      ) : null}
    </SectionCard>
  );
}
