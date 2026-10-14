// One logged dose (or a day's as-needed doses) from the MAR: when it was
// taken and documented, route, who, PRN reason and follow-up, notes,
// controlled count, linked incident and corrections. People with medical
// edit rights can add a correction; the original stays as it was.

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nameWithStrength } from "@/lib/medications/med-display";
import { isLateEntry, logKind } from "@/lib/medications/mar-cells";
import { isLateDose } from "@/lib/medications/give-meds";
import { longDateTime } from "@/lib/medications/mar-month";
import { doseCountCells } from "@/lib/medications/mar-pdf-rows";
import { useAddCorrection, type MarMonth } from "./use-mar";

type Dose = MarMonth["doses"][number];

const KIND: Record<string, string> = {
  given: "Given",
  refused: "Refused",
  missed: "Missed",
  held: "Held",
  away: "Not at home",
};
const EFFECT: Record<string, string> = { helped: "Helped", partly: "Partly", no: "Didn't help" };

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Correction({ dose, clientId, month }: { dose: Dose; clientId: string; month: string }) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const add = useAddCorrection(clientId, month);
  useEffect(() => {
    setNote("");
    setReason("");
  }, [dose.id]);
  const ready = note.trim().length >= 3 && reason.trim().length >= 3;
  return (
    <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">Add a correction</p>
      <div className="space-y-1">
        <Label>What should the record say?</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Reason for the correction</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!ready || add.isPending}
        onClick={() =>
          add.mutate(
            { logId: dose.id, note: note.trim(), reason: reason.trim() },
            { onSuccess: () => (setNote(""), setReason("")) },
          )
        }
      >
        {add.isPending ? "Saving…" : "Add correction"}
      </Button>
    </div>
  );
}

function DoseDetail(p: { data: MarMonth; dose: Dose; canEdit: boolean; clientId: string }) {
  const { data, dose } = p;
  const med = data.meds.find((m) => m.id === dose.medication_id);
  const count = data.counts.find((c) => c.emar_log_id === dose.id);
  const addenda = data.addenda.filter((a) => a.emar_log_id === dose.id);
  const controlled = dose.is_controlled ?? !!med?.is_controlled;
  const [before, after] = doseCountCells({
    controlled,
    before: count?.counted_value ?? dose.pill_count_value,
    after: count?.count_after,
  });
  const staff =
    (dose.staff_id && (data.names[dose.staff_id] || null)) || dose.staff_name || "Unknown";
  const followup = dose.prn_followup_at
    ? `${EFFECT[dose.prn_effect ?? ""] ?? "Checked"} · ${longDateTime(dose.prn_followup_at)}${dose.prn_followup_note ? ` · ${dose.prn_followup_note}` : ""}`
    : dose.prn_followup_due_at
      ? `Not checked yet (due ${longDateTime(dose.prn_followup_due_at)})`
      : null;
  return (
    <section className="rounded-lg border p-3" data-testid="mar-dose">
      <p className="font-medium">
        {med ? nameWithStrength(med) : "Medication"} · {KIND[logKind(dose)]}
      </p>
      <dl className="mt-2 space-y-1">
        <Fact label="Due" value={dose.is_prn ? "As needed" : longDateTime(dose.scheduled_for)} />
        <Fact
          label="Taken"
          value={`${longDateTime(dose.actual_taken_at ?? dose.administered_at)}${isLateDose(dose) ? " (late dose)" : ""}`}
        />
        <Fact
          label="Documented"
          value={`${longDateTime(dose.documented_at ?? dose.created_at)}${isLateEntry(dose) ? " (late entry)" : ""}`}
        />
        <Fact label="Route" value={dose.route} />
        <Fact label="Staff" value={staff} />
        <Fact label="PRN reason" value={dose.prn_reason} />
        <Fact label="Tried first" value={dose.prn_tried_first} />
        <Fact label="Did it help?" value={followup} />
        <Fact label="Reason not given" value={dose.exception_reason} />
        <Fact label="Notes" value={dose.notes} />
        <Fact
          label="Error"
          value={dose.is_medication_error ? dose.error_description || "Yes" : null}
        />
        <Fact label="Incident" value={data.incidents[dose.id]} />
        <Fact
          label="Controlled count"
          value={
            controlled && logKind(dose) === "given"
              ? `Before ${before} · After ${after}${count?.flagged ? " · flagged" : ""}`
              : null
          }
        />
      </dl>
      {addenda.length ? (
        <ul className="mt-3 space-y-2">
          {addenda.map((a) => (
            <li key={a.id} className="rounded-md bg-muted/50 p-2 text-sm">
              <p className="font-medium">Correction: {a.note}</p>
              {a.reason ? <p className="text-xs">Reason: {a.reason}</p> : null}
              <p className="text-xs text-muted-foreground">
                {a.staff_name || "Staff"} · {longDateTime(a.created_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {p.canEdit ? <Correction dose={dose} clientId={p.clientId} month={data.month} /> : null}
    </section>
  );
}

export function MarDoseSheet({
  data,
  logIds,
  canEdit,
  clientId,
  onClose,
}: {
  data: MarMonth;
  logIds: string[] | null;
  canEdit: boolean;
  clientId: string;
  onClose: () => void;
}) {
  const doses = data.doses.filter((d) => logIds?.includes(d.id));
  return (
    <Sheet open={!!logIds} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="mar-dose-sheet">
        <SheetHeader>
          <SheetTitle>{doses.length > 1 ? "Doses" : "Dose"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {doses.map((d) => (
            <DoseDetail key={d.id} data={data} dose={d} canEdit={canEdit} clientId={clientId} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
