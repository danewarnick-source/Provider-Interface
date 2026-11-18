// The board's header: the week (or month) with previous / next, whether
// anything is waiting to go to staff, Add shift, Copy week and Send N changes
// (B4). The count is the week's unsent changes to published shifts plus its
// drafts (publish-plan.ts); "Published ✓" when there's nothing new. Both
// buttons open their dialog (publish-dialog.tsx, copy-week-dialog.tsx).
import { ChevronLeft, ChevronRight, Copy, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { publishPlan } from "@/lib/scheduler/publish-plan";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";
import { SchedulingSettingsLink } from "@/components/scheduler/settings/place-settings-card";
import { useBoard, type Board } from "./board-context";
import { newDraft } from "./add-draft";
import { Pill } from "./board-ui";

/** The week's changes and drafts waiting to be sent. */
export function waitingCount(b: Board): number {
  const inWeek = (iso: string) => b.days.includes(dayKey(iso));
  return publishPlan({
    shifts: b.shifts,
    changes: b.changes.filter((c) => inWeek(c.before.starts_at) || inWeek(c.after.starts_at)),
    findings: [],
    otHours: b.data.otHours,
    weekDays: b.days,
  }).count;
}

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
  const today = dayKey(new Date());
  const waiting = waitingCount(b);
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
            {waiting ? (
              <Pill tone="gold">
                {waiting} change{waiting === 1 ? "" : "s"} not sent
              </Pill>
            ) : (
              <Pill tone="ok">Published · staff notified</Pill>
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
                <>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => b.open({ kind: "copy" })}
                  >
                    <Copy className="mr-1 h-4 w-4" /> Copy week
                  </Button>
                  <Button
                    variant={waiting ? "default" : "outline"}
                    className="min-h-11"
                    onClick={() => b.open({ kind: "publish" })}
                  >
                    {waiting ? (
                      <>
                        <Send className="mr-1 h-4 w-4" /> Send {waiting} change
                        {waiting === 1 ? "" : "s"}
                      </>
                    ) : (
                      "Published ✓"
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
