// Shown above the sections on a discharged client's profile: when and why,
// what the discharge ended, and the discharge summary with its 7-day clock
// (write or confirm it, then mark it sent). The rest of the profile is
// read-only.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/hooks/use-access";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { endedLines, INITIATED_BY, summaryClock } from "@/lib/clients/discharge";
import type { DischargeRecord } from "@/lib/clients/discharge.functions";
import { cn } from "@/lib/utils";
import { SummaryFields, type SummaryDraftState } from "./summary-fields";
import { useClientDischarge, useDischargeWrites, useDraftSummary } from "./use-discharge";

function clockText(d: DischargeRecord): { text: string; tone: string } {
  const c = summaryClock(d);
  if (c.state === "sent")
    return { text: `Summary sent ${formatDate(d.summary_sent_on)}`, tone: "text-muted-foreground" };
  if (c.state === "late")
    return { text: `Summary was due ${formatDate(c.dueOn)}`, tone: "text-destructive" };
  return {
    text: `Summary due ${formatDate(c.dueOn)} (${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left)`,
    tone: "text-hive-ink",
  };
}

export function DischargeCard({
  orgId,
  clientId,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  onChanged: () => void;
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const q = useClientDischarge(orgId, clientId, true);
  const draft = useDraftSummary(orgId, clientId);
  const { saveSummary, markSent } = useDischargeWrites(orgId, clientId, onChanged);
  const [edit, setEdit] = useState<SummaryDraftState | null>(null);
  const [sentOn, setSentOn] = useState(todayYmd());

  const d = q.data;
  if (!d) {
    return (
      <SectionCard
        icon={LogOut}
        tone="danger"
        title="Discharged"
        description={
          q.isLoading
            ? "Loading discharge…"
            : "Their record is read-only. Reactivate them from the ⋯ menu to make changes."
        }
        className="mb-5"
        testId="discharge-card"
      />
    );
  }
  const clock = clockText(d);
  const confirmed = !!d.summary_confirmed_at;
  const editing = edit ?? {
    text: d.summary_text ?? "",
    draftedByNectar: d.summary_drafted_by_nectar,
    confirmed: false,
  };
  const fail = (e: Error) => toast.error(e.message);

  return (
    <SectionCard
      icon={LogOut}
      tone="danger"
      title={`Discharged ${formatDate(d.discharge_date)}`}
      description={`Started by ${INITIATED_BY[d.initiated_by].toLowerCase().replace(/^dspd$/, "DSPD")}. The record is read-only.`}
      className="mb-5"
      testId="discharge-card"
      actions={
        <p className={cn("text-sm font-medium", clock.tone)} data-testid="discharge-summary-clock">
          {clock.text}
        </p>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="whitespace-pre-wrap text-muted-foreground">{d.reason}</p>
        {d.notice_date ? (
          <p className="text-muted-foreground">Notice given {formatDate(d.notice_date)}</p>
        ) : null}
        <ul className="list-disc pl-5 text-muted-foreground">
          {endedLines(d.ended).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Reactivating doesn't undo ended authorizations or cancelled shifts.
        </p>

        {confirmed ? (
          <div className="space-y-2 border-t pt-3">
            <p className="font-medium">Discharge summary (confirmed)</p>
            <p className="whitespace-pre-wrap">{d.summary_text}</p>
            {!d.summary_sent_on && canEdit ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  type="date"
                  className="h-10 w-44"
                  value={sentOn}
                  onChange={(e) => setSentOn(e.target.value)}
                  aria-label="Date sent"
                />
                <Button
                  disabled={!sentOn || markSent.isPending}
                  onClick={() => markSent.mutate({ dischargeId: d.id, sentOn }, { onError: fail })}
                  data-testid="discharge-summary-mark-sent"
                >
                  Mark summary sent
                </Button>
              </div>
            ) : null}
          </div>
        ) : canEdit ? (
          <div className="space-y-2 border-t pt-3">
            <SummaryFields
              value={editing}
              onChange={setEdit}
              drafting={draft.isPending}
              onDraft={() =>
                draft.mutate(
                  {
                    dischargeDate: d.discharge_date,
                    reason: d.reason,
                    initiatedBy: d.initiated_by,
                  },
                  {
                    onSuccess: (r) =>
                      setEdit({ text: r.text, draftedByNectar: true, confirmed: false }),
                    onError: fail,
                  },
                )
              }
            />
            <Button
              disabled={saveSummary.isPending || (!editing.text.trim() && !d.summary_text)}
              onClick={() =>
                saveSummary.mutate(
                  {
                    dischargeId: d.id,
                    text: editing.text,
                    draftedByNectar: editing.draftedByNectar,
                    confirm: editing.confirmed,
                  },
                  { onSuccess: () => setEdit(null), onError: fail },
                )
              }
              data-testid="discharge-summary-save"
            >
              {editing.confirmed ? "Confirm summary" : "Save summary draft"}
            </Button>
          </div>
        ) : (
          <p className="border-t pt-3 text-muted-foreground">
            The discharge summary isn't confirmed yet.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
