// The new PCSP's goals compared with the current plan's. Continuing and
// changed goals keep their progress history (carried over); new goals start
// fresh; current goals the PCSP doesn't list end with the old plan year.
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PcspRead } from "@/lib/clients/pcsp/import.functions";
import type { CarryKind } from "@/lib/clients/pcsp/carry-over";
import type { ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { ReviewEdit } from "./pcsp-review";

const KIND_LABEL: Record<CarryKind, string> = { continuing: "Continuing", changed: "Changed", new: "New" };

export function PcspReviewGoals({ read, review, edit }: { read: PcspRead; review: ReviewedPcsp; edit: ReviewEdit }) {
  const current = [
    ...read.carry.goals.filter((g) => g.fromGoalId).map((g) => ({ id: g.fromGoalId!, text: g.fromGoalText ?? "" })),
    ...read.carry.ended.map((g) => ({ id: g.goalId, text: g.goalText })),
  ];
  const textOf = (id: string | null) => current.find((c) => c.id === id)?.text ?? null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Goals compared with last year</h3>
      {review.goals.length === 0 && <p className="text-xs text-muted-foreground">No goals were read.</p>}
      <ol className="space-y-2">
        {review.goals.map((g, i) => (
          <li key={i} className="space-y-1.5 rounded-md border p-2" data-testid="pcsp-review-goal">
            <div className="flex items-start gap-2">
              <Checkbox
                className="mt-2" checked={g.include} aria-label="Keep this goal"
                onCheckedChange={(v) => edit((d) => { d.goals[i].include = v === true; })}
              />
              <div className="flex-1 space-y-1">
                <Input
                  className="h-8" value={g.goal} aria-label="Goal"
                  onChange={(e) => edit((d) => { d.goals[i].goal = e.target.value; })}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Page {g.page}</span>
                  {g.domain && <span>· {g.domain}</span>}
                  <select
                    className="h-7 rounded border bg-background px-1 text-foreground" aria-label="Compared with last year"
                    value={g.carry.kind}
                    onChange={(e) => edit((d) => {
                      const kind = e.target.value as CarryKind;
                      const from = kind === "new" ? null : d.goals[i].carry.fromGoalId ?? current[0]?.id ?? null;
                      d.goals[i].carry = { kind: from ? kind : "new", fromGoalId: from, fromGoalText: textOf(from) };
                    })}
                  >
                    {(Object.keys(KIND_LABEL) as CarryKind[]).map((k) => (
                      <option key={k} value={k} disabled={k !== "new" && current.length === 0}>{KIND_LABEL[k]}</option>
                    ))}
                  </select>
                  {g.carry.kind !== "new" && (
                    <select
                      className="h-7 max-w-[18rem] rounded border bg-background px-1 text-foreground" aria-label="Last year's goal"
                      value={g.carry.fromGoalId ?? ""}
                      onChange={(e) => edit((d) => { d.goals[i].carry.fromGoalId = e.target.value; d.goals[i].carry.fromGoalText = textOf(e.target.value); })}
                    >
                      {current.map((c) => <option key={c.id} value={c.id}>{c.text.slice(0, 80)}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <ul className="ml-6 space-y-1 text-xs">
              {g.supports.map((s, j) => (
                <li key={j} className="flex flex-wrap items-center gap-1">
                  <span>{s.support || <em className="text-muted-foreground">(no support text)</em>}</span>
                  {s.ourCodes.map((c) => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
                  {s.providers.filter((p) => !p.ours).map((p) => (
                    <Badge key={`${p.code}-${p.provider}`} variant="outline" className="text-[10px]">{p.code} · {p.provider}</Badge>
                  ))}
                </li>
              ))}
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
                {g.ongoing === true && " — last year's review said this goal continues; match it above if it does."}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
