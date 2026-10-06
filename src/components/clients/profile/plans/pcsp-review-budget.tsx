// Our budget lines from the PCSP. Each kept line becomes (or updates) the
// client's authorization for that code when the review is confirmed.
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ReviewedPcsp } from "@/lib/clients/pcsp/review";
import type { ReviewEdit } from "./pcsp-review";

const UNIT_LABEL: Record<string, string> = { Q: "15 min", day: "Day", hourly: "Hour" };

export function PcspReviewBudget({ review, edit }: { review: ReviewedPcsp; edit: ReviewEdit }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">Budget for us</h3>
      {review.budget.length === 0 ? (
        <p className="text-xs text-muted-foreground">No budget lines name your agency.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-1">Keep</th><th className="p-1">Code</th><th className="p-1">Unit</th>
                <th className="p-1">Rate</th><th className="p-1">Per month</th><th className="p-1">Per year</th>
                <th className="p-1">Starts</th><th className="p-1">Ends</th>
              </tr>
            </thead>
            <tbody>
              {review.budget.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">
                    <Checkbox
                      checked={b.include} aria-label={`Keep ${b.code || "line"}`}
                      onCheckedChange={(v) => edit((d) => { d.budget[i].include = v === true; })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7 w-16" value={b.code} aria-label="Code"
                      onChange={(e) => edit((d) => { d.budget[i].code = e.target.value.toUpperCase(); })}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="h-7 rounded border bg-background px-1" value={b.unitType} aria-label="Unit"
                      onChange={(e) => edit((d) => { d.budget[i].unitType = e.target.value; })}
                    >
                      {Object.entries(UNIT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7 w-20" type="number" step="0.01" min={0} value={b.rate} aria-label="Rate"
                      onChange={(e) => edit((d) => { d.budget[i].rate = Number(e.target.value); })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7 w-20" type="number" min={0} value={b.maxMonthlyUnits ?? ""} aria-label="Units per month"
                      onChange={(e) => edit((d) => { d.budget[i].maxMonthlyUnits = e.target.value === "" ? null : Math.round(Number(e.target.value)); })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7 w-20" type="number" min={0} value={b.annualUnits} aria-label="Units per year"
                      onChange={(e) => edit((d) => { d.budget[i].annualUnits = Math.round(Number(e.target.value)); })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7" type="date" value={b.start ?? ""} aria-label="Starts"
                      onChange={(e) => edit((d) => { d.budget[i].start = e.target.value || null; })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-7" type="date" value={b.end ?? ""} aria-label="Ends"
                      onChange={(e) => edit((d) => { d.budget[i].end = e.target.value || null; })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
