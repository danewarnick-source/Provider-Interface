// Health events log: exams, injuries, surgeries, immunizations, health
// changes and hospital stays, newest first, each optionally tied to a
// document in the client file.

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { HEALTH_EVENT_TYPES, labelFor } from "@/lib/clients/health";
import { LabeledInput } from "@/components/clients/profile/cards/card-shell";
import { RecordList } from "./record-list";
import { PickField, RecordDialog } from "./record-dialog";
import { useCanEditMedical } from "./use-client-health";
import { useClientDocumentOptions, useHealthRecords, type HealthEventRow } from "./use-health-records";

const NO_DOC = "none";
const blank = () => ({ date: todayYmd(), type: "", notes: "", doc: NO_DOC });

export function HealthEventsCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const canEdit = useCanEditMedical();
  const { list, add, archive } = useHealthRecords<HealthEventRow>("client_health_events", orgId, clientId);
  const docs = useClientDocumentOptions(orgId, clientId);
  const [draft, setDraft] = useState<ReturnType<typeof blank> | null>(null);
  const docName = (id: string | null) => docs.data?.find((d) => d.id === id)?.file_name ?? null;
  const problem = !draft?.date ? "Pick the date." : !draft.type ? "Pick what happened." : null;
  return (
    <RecordList
      title="Health events"
      subtitle="Exams, injuries, surgeries, immunizations, health changes and hospital stays."
      testId="client-health-events"
      rows={list.data ?? []}
      loading={list.isLoading}
      empty="Nothing logged yet."
      canEdit={canEdit}
      onAdd={() => setDraft(blank())}
      onRemove={(r) => archive.mutate(r.id)}
      render={(r) => (
        <>
          <div className="font-medium">
            {formatDate(r.event_date)} · {labelFor(HEALTH_EVENT_TYPES, r.event_type)}
          </div>
          {r.notes ? <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p> : null}
          {docName(r.document_id) ? <p className="text-xs text-muted-foreground">Document: {docName(r.document_id)}</p> : null}
        </>
      )}
    >
      {draft ? (
        <RecordDialog
          title="Log a health event"
          open
          saving={add.isPending}
          problem={problem}
          onClose={() => setDraft(null)}
          onSave={() =>
            add.mutate(
              {
                event_date: draft.date,
                event_type: draft.type,
                notes: draft.notes.trim() || null,
                document_id: draft.doc === NO_DOC ? null : draft.doc,
              },
              { onSuccess: () => setDraft(null) },
            )
          }
        >
          <LabeledInput label="Date" type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} />
          <PickField label="What happened" value={draft.type} options={HEALTH_EVENT_TYPES} onChange={(v) => setDraft({ ...draft, type: v })} />
          <Textarea aria-label="Notes" rows={3} placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <PickField
            label="Document (optional)"
            value={draft.doc}
            options={[{ value: NO_DOC, label: "No document" }, ...(docs.data ?? []).map((d) => ({ value: d.id, label: d.file_name }))]}
            onChange={(v) => setDraft({ ...draft, doc: v })}
          />
        </RecordDialog>
      ) : null}
    </RecordList>
  );
}
