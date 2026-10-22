// Recent health events: exams, injuries, surgeries, immunizations, health
// changes and hospital stays as a timeline, newest first, a colored dot by
// type, each optionally tied to a document in the client file. "Log a
// health event" lives on the Health header; this card opens the dialog.

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { HEALTH_EVENT_TYPES, labelFor } from "@/lib/clients/health";
import { healthEventTone } from "@/lib/clients/health-tiles";
import { cn } from "@/lib/utils";
import { LabeledInput } from "@/components/clients/profile/cards/card-parts";
import { RecordList } from "./record-list";
import { PickField, RecordDialog } from "./record-dialog";
import { useCanEditMedical } from "./use-client-health";
import {
  useClientDocumentOptions,
  useHealthRecords,
  type HealthEventRow,
} from "./use-health-records";

const NO_DOC = "none";
const blank = () => ({ date: todayYmd(), type: "", notes: "", doc: NO_DOC });

const DOT: Record<ReturnType<typeof healthEventTone>, string> = {
  info: "bg-[var(--hive-info)]",
  ok: "bg-[var(--hive-ok)]",
  danger: "bg-[var(--hive-danger)]",
  profile: "bg-hive-gold",
  neutral: "bg-hive-border",
};

export function HealthEventsCard({
  orgId,
  clientId,
  logging,
  onLog,
  onDone,
}: {
  orgId: string;
  clientId: string;
  /** The Health header's "Log a health event" was pressed. */
  logging: boolean;
  onLog: () => void;
  onDone: () => void;
}) {
  const canEdit = useCanEditMedical();
  const { list, add, archive } = useHealthRecords<HealthEventRow>(
    "client_health_events",
    orgId,
    clientId,
  );
  const docs = useClientDocumentOptions(orgId, clientId);
  const [form, setForm] = useState(blank);
  const draft = logging ? form : null;
  const setDraft = (d: ReturnType<typeof blank> | null) => {
    if (d) setForm(d);
    else {
      setForm(blank());
      onDone();
    }
  };
  const docName = (id: string | null) => docs.data?.find((d) => d.id === id)?.file_name ?? null;
  const problem = !draft?.date ? "Pick the date." : !draft.type ? "Pick what happened." : null;
  return (
    <RecordList
      icon={Stethoscope}
      addLabel="Log a health event"
      id="health-events"
      title="Recent health events"
      subtitle="Exams, injuries, surgeries, immunizations, health changes and hospital stays."
      addInCard={false}
      testId="client-health-events"
      rows={list.data ?? []}
      loading={list.isLoading}
      empty="Nothing logged yet."
      canEdit={canEdit}
      onAdd={onLog}
      onRemove={(r) => archive.mutate(r.id)}
      render={(r) => (
        <div className="flex gap-3">
          <span
            aria-hidden
            className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[healthEventTone(r.event_type)])}
          />
          <div className="min-w-0">
            <div className="font-medium">
              {labelFor(HEALTH_EVENT_TYPES, r.event_type)} · {formatDate(r.event_date)}
            </div>
            {r.notes ? (
              <p className="line-clamp-3 whitespace-pre-wrap text-muted-foreground">{r.notes}</p>
            ) : null}
            {docName(r.document_id) ? (
              <p className="text-xs text-muted-foreground">Document: {docName(r.document_id)}</p>
            ) : null}
          </div>
        </div>
      )}
    >
      {draft ? (
        <RecordDialog
          title="Log a health event"
          saveLabel="Save health event"
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
          <LabeledInput
            label="Date"
            type="date"
            value={draft.date}
            onChange={(v) => setDraft({ ...draft, date: v })}
          />
          <PickField
            label="What happened"
            value={draft.type}
            options={HEALTH_EVENT_TYPES}
            onChange={(v) => setDraft({ ...draft, type: v })}
          />
          <Textarea
            aria-label="Notes"
            rows={3}
            placeholder="Notes"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
          <PickField
            label="Document (optional)"
            value={draft.doc}
            options={[
              { value: NO_DOC, label: "No document" },
              ...(docs.data ?? []).map((d) => ({ value: d.id, label: d.file_name })),
            ]}
            onChange={(v) => setDraft({ ...draft, doc: v })}
          />
        </RecordDialog>
      ) : null}
    </RecordList>
  );
}
