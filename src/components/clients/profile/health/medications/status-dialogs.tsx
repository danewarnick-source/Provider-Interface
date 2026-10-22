// Pause, resume and stop (with a reason; nothing is deleted) and "Send with
// client" (where it went, how many, who received it).

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecordDialog } from "@/components/clients/profile/health/record-dialog";
import {
  useSendMedication,
  useSetMedicationStatus,
  type ClientMedication,
} from "./use-medications";

export type StatusAction = "pause" | "resume" | "stop";

const TITLE: Record<StatusAction, string> = { pause: "Pause", resume: "Resume", stop: "Stop" };

export function StatusDialog({
  clientId,
  medication,
  action,
  onClose,
}: {
  clientId: string;
  medication: ClientMedication | null;
  action: StatusAction;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const status = useSetMedicationStatus(clientId);
  useEffect(() => setReason(""), [medication, action]);
  const needsReason = action !== "resume";
  return (
    <RecordDialog
      title={`${TITLE[action]} ${medication?.medication_name ?? ""}`}
      saveLabel={TITLE[action]}
      open={!!medication}
      saving={status.isPending}
      problem={needsReason && !reason.trim() ? "Add a reason." : null}
      onClose={onClose}
      onSave={() =>
        medication &&
        status.mutate(
          { id: medication.id, action, reason: reason.trim() || null },
          { onSuccess: onClose },
        )
      }
    >
      {action === "stop" ? (
        <p className="text-sm text-muted-foreground">
          Stopping keeps the medication and its doses on record. It moves to stopped medications.
        </p>
      ) : null}
      <div className="space-y-1">
        <Label>{needsReason ? "Reason" : "Note (optional)"}</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </RecordDialog>
  );
}

export function SendDialog({
  clientId,
  medication,
  onClose,
}: {
  clientId: string;
  medication: ClientMedication | null;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [quantity, setQuantity] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const send = useSendMedication(clientId);
  useEffect(() => {
    setTo("");
    setQuantity("");
    setReceivedBy("");
    setNote("");
  }, [medication]);
  const qty = Number(quantity);
  const problem = !to.trim()
    ? "Add where it went."
    : !(Number.isInteger(qty) && qty > 0)
      ? "Add how many were sent."
      : !receivedBy.trim()
        ? "Add who received it."
        : null;
  return (
    <RecordDialog
      title={`Send ${medication?.medication_name ?? ""} with the client`}
      saveLabel="Record"
      open={!!medication}
      saving={send.isPending}
      problem={problem}
      onClose={onClose}
      onSave={() =>
        medication &&
        send.mutate(
          {
            id: medication.id,
            to: to.trim(),
            quantity: qty,
            receivedBy: receivedBy.trim(),
            note: note.trim() || null,
          },
          { onSuccess: onClose },
        )
      }
    >
      <div className="space-y-1">
        <Label>Where it went</Label>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="e.g. Family visit, school, day program"
        />
      </div>
      <div className="space-y-1">
        <Label>How many</Label>
        <Input
          type="number"
          min={1}
          step="1"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label>Received by</Label>
        <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Note (optional)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </RecordDialog>
  );
}
