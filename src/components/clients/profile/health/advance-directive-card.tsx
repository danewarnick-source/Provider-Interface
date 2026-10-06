// Advance directive: None / DNR / POLST, where the paper is kept, notes,
// and palliative care / hospice folded in. DNR or POLST makes the signed
// document required in the client file (dnr_applicable follows the status).

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DIRECTIVE_OPTIONS,
  directiveLabel,
  directivePatch,
  directiveStatus,
  type DirectiveDraft,
  type DirectiveStatus,
} from "@/lib/clients/health";
import { CardShell, Row } from "@/components/clients/profile/cards/card-shell";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function AdvanceDirectiveCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const save = useSaveHealth(orgId, health.id, () => setDraft(null));
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<DirectiveDraft | null>(null);
  const status = directiveStatus(health.dnr_status) ?? (health.polst_status ? "polst" : null);
  const set = (patch: Partial<DirectiveDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  return (
    <CardShell
      title="Advance directive"
      editing={draft !== null}
      canEdit={canEdit}
      onEdit={() =>
        setDraft({
          status: status ?? "none",
          location: health.dnr_location ?? "",
          palliative: health.palliative_care_status ?? "",
          hospice: health.hospice_status ?? "",
          notes: health.advance_directive_notes ?? "",
        })
      }
      onCancel={() => setDraft(null)}
      saving={save.isPending}
      onSave={() => draft && save.mutate(directivePatch(draft))}
    >
      {draft ? (
        <div className="grid gap-3" data-testid="advance-directive-form">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={draft.status} onValueChange={(v) => set({ status: v as DirectiveStatus })}>
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
            <Field label="Where the signed form is kept" value={draft.location} onChange={(v) => set({ location: v })} />
          ) : null}
          <Field label="Palliative care" value={draft.palliative} onChange={(v) => set({ palliative: v })} />
          <Field label="Hospice" value={draft.hospice} onChange={(v) => set({ hospice: v })} />
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>
      ) : (
        <div data-testid="advance-directive">
          <Row label="Status">{directiveLabel(status)}</Row>
          {status && status !== "none" ? <Row label="Kept at">{health.dnr_location || null}</Row> : null}
          <Row label="Palliative care">{health.palliative_care_status || null}</Row>
          <Row label="Hospice">{health.hospice_status || null}</Row>
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
    </CardShell>
  );
}
