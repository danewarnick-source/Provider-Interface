// The new PCSP's goals: each is "Carried over from last year" (its progress
// history continues; last year's wording shows when it changed) or a "New
// goal". Current goals the PCSP doesn't list end with the old plan year.
// Non-goal supports ("other needs") follow; kept ones get support strategies.
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PcspRead } from "@/lib/clients/pcsp/import.functions";
import { sameWording } from "@/lib/clients/pcsp/carry-over";
import type { ReviewSupport, ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { ReviewEdit } from "./pcsp-review";
import { SupportLines } from "./support-lines";

const SELECT = "h-9 rounded border bg-background px-2 text-foreground";

function ReviewSupportLines({ s }: { s: ReviewSupport }) {
  return (
    <SupportLines
      support={s.support}
      details={s.details}
      codes={s.ourCodes}
      extra={s.providers.filter((p) => !p.ours).map((p) => (
        <Badge key={`${p.code}-${p.provider}`} variant="outline" className="text-[10px]">
          {p.code} · {p.provider}
        </Badge>
      ))}
    />
  );
}

export function PcspReviewGoals({ read, review, edit }: { read: PcspRead; review: ReviewedPcsp; edit: ReviewEdit }) {
  const current = [
    ...read.carry.goals.filter((g) => g.fromGoalId).map((g) => ({ id: g.fromGoalId!, text: g.fromGoalText ?? "" })),
    ...read.carry.ended.map((g) => ({ id: g.goalId, text: g.goalText })),
  ];
  const textOf = (id: string | null) => current.find((c) => c.id === id)?.text ?? null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Goals</h3>
      {review.goals.length === 0 && <p className="text-xs text-muted-foreground">No goals were read.</p>}
      <ol className="space-y-2">
        {review.goals.map((g, i) => (
          <li key={i} className="space-y-1.5 rounded-xl border border-hive-border p-3" data-testid="pcsp-review-goal">
            <div className="flex items-start gap-2">
              <Checkbox
                className="mt-2" checked={g.include} aria-label="Keep this goal"
                onCheckedChange={(v) => edit((d) => { d.goals[i].include = v === true; })}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  className="h-9" value={g.goal} aria-label="Goal"
                  onChange={(e) => edit((d) => { d.goals[i].goal = e.target.value; })}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Page {g.page}</span>
                  {g.domain && <span>· {g.domain}</span>}
                  <select
                    className={SELECT} aria-label="Compared with last year" value={g.carry.kind}
                    onChange={(e) => edit((d) => {
                      const from = e.target.value === "carried" ? d.goals[i].carry.fromGoalId ?? current[0]?.id ?? null : null;
                      d.goals[i].carry = { kind: from ? "carried" : "new", fromGoalId: from, fromGoalText: textOf(from) };
                    })}
                  >
                    <option value="carried" disabled={current.length === 0}>Carried over from last year</option>
                    <option value="new">New goal</option>
                  </select>
                  {g.carry.kind === "carried" && current.length > 1 && (
                    <select
                      className={`${SELECT} max-w-[18rem]`} aria-label="Last year's goal" value={g.carry.fromGoalId ?? ""}
                      onChange={(e) => edit((d) => { d.goals[i].carry.fromGoalId = e.target.value; d.goals[i].carry.fromGoalText = textOf(e.target.value); })}
                    >
                      {current.map((c) => <option key={c.id} value={c.id}>{c.text.slice(0, 80)}</option>)}
                    </select>
                  )}
                </div>
                {g.carry.kind === "carried" && g.carry.fromGoalText && !sameWording(g.carry.fromGoalText, g.goal) ? (
                  <p className="text-xs text-muted-foreground">Last year: {g.carry.fromGoalText}</p>
                ) : null}
              </div>
            </div>
            <ul className="ml-6 space-y-2 border-l-2 border-border pl-3">
              {g.supports.map((s, j) => <li key={j}><ReviewSupportLines s={s} /></li>)}
            </ul>
          </li>
        ))}
      </ol>
      {read.carry.ended.length > 0 && (
        <div className="text-xs">
          <p className="font-medium">Ending with the old plan year</p>
          <ul className="ml-4 list-disc text-muted-foreground">
            {read.carry.ended.map((g) => (
              <li key={g.goalId}>
                {g.goalText}
                {g.ongoing === true && " (last year's review said this goal continues; mark it above if it does)"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {review.otherNeeds.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Other needs in the PCSP</h3>
          <ul className="space-y-2">
            {review.otherNeeds.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Checkbox
                  className="mt-1" checked={s.include} aria-label="Keep this support"
                  onCheckedChange={(v) => edit((d) => { d.otherNeeds[i].include = v === true; })}
                />
                <ReviewSupportLines s={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
