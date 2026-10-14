import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPrnFollowup } from "@/lib/medications/give-meds.functions";
import { nameWithStrength } from "@/lib/medications/med-display";
import { clockTime, type GiveLog, type GiveMed } from "@/lib/medications/give-meds";

type Effect = "helped" | "partly" | "no";
const EFFECTS: Array<{ value: Effect; label: string }> = [
  { value: "helped", label: "Helped" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "Didn't help" },
];

/** "Did it help?" for one PRN dose whose follow-up is due. */
export function FollowupCard({
  log,
  med,
  onSaved,
}: {
  log: GiveLog;
  med: GiveMed | undefined;
  onSaved: () => void;
}) {
  const save = useServerFn(recordPrnFollowup);
  const [effect, setEffect] = useState<Effect | null>(null);
  const [note, setNote] = useState("");
  const [triedFirst, setTriedFirst] = useState("");
  const [told, setTold] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const psych = !!med?.is_psychotropic;

  async function submit() {
    if (!effect) return toast.error("Pick whether it helped.");
    if (psych && !triedFirst.trim()) return toast.error("Add what was tried first.");
    if (psych && told === null) return toast.error("Say whether the nurse or prescriber was told.");
    setSaving(true);
    try {
      await save({
        data: {
          logId: log.id,
          effect,
          note: note.trim() || null,
          triedFirst: triedFirst.trim() || null,
          prescriberNotified: told,
        },
      });
      toast.success("Follow-up saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the follow-up.");
    } finally {
      setSaving(false);
    }
  }

  const given = log.actual_taken_at ?? log.administered_at ?? log.scheduled_for;
  return (
    <li className="space-y-3 rounded-lg border border-amber-400 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <div>
        <p className="text-sm font-semibold">
          Did it help? {med ? nameWithStrength(med) : "As-needed medication"}
        </p>
        <p className="text-xs text-muted-foreground">
          Given {clockTime(given)}
          {log.staff_name ? ` by ${log.staff_name}` : ""}
          {log.prn_reason ? ` for: ${log.prn_reason}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {EFFECTS.map((e) => (
          <Button
            key={e.value}
            type="button"
            size="sm"
            className="h-10"
            variant={effect === e.value ? "default" : "outline"}
            onClick={() => setEffect(e.value)}
          >
            {e.label}
          </Button>
        ))}
      </div>
      {psych ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor={`tried-${log.id}`}>What was tried first? *</Label>
            <Input
              id={`tried-${log.id}`}
              value={triedFirst}
              onChange={(e) => setTriedFirst(e.target.value)}
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <p className="text-sm font-medium">Was the nurse or prescriber told? *</p>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={told === true ? "default" : "outline"}
                onClick={() => setTold(true)}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={told === false ? "default" : "outline"}
                onClick={() => setTold(false)}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="bg-background"
      />
      <Button size="sm" onClick={submit} disabled={saving}>
        {saving ? "Saving…" : "Save follow-up"}
      </Button>
    </li>
  );
}
