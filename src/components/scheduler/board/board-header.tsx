// The board's header: the week (or month) with previous / next, whether
// everything is published, Add shift, and Publish. Publish works as it did
// before B3 (all or nothing through the rule engine, publish.functions.ts);
// B4 redoes it as Send changes.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishWeek } from "@/lib/scheduler/publish.functions";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { isCancelled } from "@/lib/scheduler/board-model";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";
import { toastRuleWarnings } from "@/components/scheduler/shared/rule-warnings";
import { SchedulingSettingsLink } from "@/components/scheduler/settings/place-settings-card";
import { useBoard } from "./board-context";
import { newDraft } from "./add-draft";
import { Pill } from "./board-ui";

type Failure = { shift_id: string; day: string; code: string | null; reason: string };

export function BoardHeader({
  week,
  month,
  onStep,
}: {
  week: string;
  month: boolean;
  onStep: (dir: -1 | 0 | 1) => void;
}) {
  const b = useBoard();
  const qc = useQueryClient();
  const publish = useServerFn(publishWeek);
  const [failures, setFailures] = useState<Failure[]>([]);
  const today = dayKey(new Date());
  const unsent = b.shifts.filter(
    (s) => s.staff_id && !s.published && !isCancelled(s) && b.days.includes(dayKey(s.starts_at)),
  ).length;
  const pub = useMutation({
    mutationFn: () =>
      publish({
        data: { organization_id: b.orgId, week_start_iso: parseLocalDate(week).toISOString() },
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        setFailures(r.failures);
        toast.error("Nothing was published. Fix the shifts listed below first.");
        return;
      }
      setFailures([]);
      toast.success(`Published: ${r.shifts} shifts sent to ${r.staff} team members.`);
      toastRuleWarnings(r);
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const title = month
    ? parseLocalDate(week).toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "long",
        year: "numeric",
      })
    : `${fmtDay(week).replace(/, \d{4}$/, "")} – ${fmtDay(addDaysKey(week, 6))}`;
  const todayLine = parseLocalDate(today).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Previous"
              onClick={() => onStep(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="px-2 text-xl font-extrabold">{title}</h1>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Next"
              onClick={() => onStep(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => onStep(0)}>
              This week
            </Button>
          </div>
          <p className="mt-1 text-sm text-[var(--hive-text-muted)]">
            Today is {todayLine} ·{" "}
            {unsent ? (
              <Pill tone="gold">
                {unsent} shift{unsent === 1 ? "" : "s"} not published
              </Pill>
            ) : (
              <Pill tone="ok">Published</Pill>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SchedulingSettingsLink />
          {b.canEdit && (
            <>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  b.open({
                    kind: "add",
                    draft: newDraft(b, { day: b.days.includes(today) ? today : week }),
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add shift
              </Button>
              {!month && (
                <Button className="min-h-11" disabled={pub.isPending} onClick={() => pub.mutate()}>
                  <Send className="mr-1 h-4 w-4" /> {pub.isPending ? "Publishing…" : "Publish"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {failures.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-[var(--hive-gold)] bg-[var(--hive-gold-soft)] px-4 py-3 text-sm"
        >
          <div className="font-semibold">
            Nothing was published. These shifts need fixing first:
          </div>
          <ul className="mt-1 list-disc pl-5">
            {failures.map((f) => (
              <li key={f.shift_id}>
                {fmtDay(f.day)}
                {f.code ? ` ${f.code}` : ""}: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
