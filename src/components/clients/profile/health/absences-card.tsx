// Absences (RHS clients): days the client is away from the home — in the
// hospital, on vacation or otherwise. An open absence has no return date.

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { ABSENCE_REASONS, absenceDays, absenceProblem, labelFor } from "@/lib/clients/health";
import { LabeledInput } from "@/components/clients/profile/cards/card-shell";
import { RecordList } from "./record-list";
import { PickField, RecordDialog } from "./record-dialog";
import { useCanEditMedical } from "./use-client-health";
import { useHealthRecords, type AbsenceRow } from "./use-health-records";

const blank = () => ({ from: todayYmd(), to: "", reason: "", notes: "" });

export function AbsencesCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const canEdit = useCanEditMedical();
  const { list, add, archive } = useHealthRecords<AbsenceRow>("client_absences", orgId, clientId);
  const [draft, setDraft] = useState<ReturnType<typeof blank> | null>(null);
  const problem = draft
    ? (absenceProblem(draft.from, draft.to || null) ?? (draft.reason ? null : "Pick the reason."))
    : null;
  return (
    <RecordList
      title="Absences"
      subtitle="Days away from the home."
      testId="client-absences"
      rows={list.data ?? []}
      loading={list.isLoading}
      empty="No absences logged."
      canEdit={canEdit}
      onAdd={() => setDraft(blank())}
      onRemove={(r) => archive.mutate(r.id)}
      render={(r) => {
        const days = absenceDays(r.from_date, r.to_date);
        return (
          <>
            <div className="font-medium">
              {formatDate(r.from_date)} – {r.to_date ? formatDate(r.to_date) : "still away"} ·{" "}
              {labelFor(ABSENCE_REASONS, r.reason)}
              {days ? ` · ${days} day${days === 1 ? "" : "s"}` : ""}
            </div>
            {r.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p> : null}
          </>
        );
      }}
    >
      {draft ? (
        <RecordDialog
          title="Log an absence"
          open
          saving={add.isPending}
          problem={problem}
          onClose={() => setDraft(null)}
          onSave={() =>
            add.mutate(
              { from_date: draft.from, to_date: draft.to || null, reason: draft.reason, notes: draft.notes.trim() || null },
              { onSuccess: () => setDraft(null) },
            )
          }
        >
          <LabeledInput label="First day away" type="date" value={draft.from} onChange={(v) => setDraft({ ...draft, from: v })} />
          <LabeledInput label="Back on (leave blank if still away)" type="date" value={draft.to} onChange={(v) => setDraft({ ...draft, to: v })} />
          <PickField label="Reason" value={draft.reason} options={ABSENCE_REASONS} onChange={(v) => setDraft({ ...draft, reason: v })} />
          <Textarea aria-label="Notes" rows={2} placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </RecordDialog>
      ) : null}
    </RecordList>
  );
}
