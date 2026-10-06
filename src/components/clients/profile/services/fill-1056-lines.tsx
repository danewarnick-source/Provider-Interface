// The service lines of a 1056 review. Each kept line becomes (or renews) the
// client's authorization for that code when the review is confirmed.

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UNIT_TYPES } from "@/lib/clients/authorizations";
import type { Review1056, Review1056Line } from "@/lib/clients/auth-1056";
import type { Review1056Edit } from "./fill-1056-review";

type Hint = (s: { page: number | null; quote: string } | null | undefined) => ReactNode;

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function Fill1056Lines({
  review,
  edit,
  hint,
}: {
  review: Review1056;
  edit: Review1056Edit;
  hint: Hint;
}) {
  if (review.lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No service lines were read. Cancel and add the authorizations by hand.
      </p>
    );
  }
  const set = (i: number, patch: Partial<Review1056Line>) =>
    edit((d) => {
      Object.assign(d.lines[i], patch);
    });
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">Service lines</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="p-1">Keep</th>
              <th className="p-1">Code</th>
              <th className="p-1">Unit</th>
              <th className="p-1">Rate</th>
              <th className="p-1">Units per year</th>
              <th className="p-1">Starts</th>
              <th className="p-1">Ends</th>
            </tr>
          </thead>
          <tbody>
            {review.lines.map((l, i) => (
              <tr key={i} className="border-t" data-testid="fill-1056-line">
                <td className="p-1">
                  <Checkbox
                    checked={l.include}
                    aria-label={`Keep ${l.code || "line"}`}
                    onCheckedChange={(v) => set(i, { include: v === true })}
                  />
                </td>
                <td className="p-1 whitespace-nowrap">
                  <Input
                    className="inline-block h-7 w-16"
                    value={l.code}
                    aria-label="Code"
                    onChange={(e) => set(i, { code: e.target.value.toUpperCase() })}
                  />
                  {hint(l.sources.code)}
                </td>
                <td className="p-1">
                  <select
                    className="h-7 rounded border bg-background px-1"
                    value={l.unitType}
                    aria-label="Unit"
                    onChange={(e) => set(i, { unitType: e.target.value })}
                  >
                    {Object.entries(UNIT_TYPES).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1 whitespace-nowrap">
                  <Input
                    className="inline-block h-7 w-20"
                    type="number"
                    step="0.01"
                    min={0}
                    value={l.rate ?? ""}
                    aria-label="Rate"
                    onChange={(e) => set(i, { rate: num(e.target.value) })}
                  />
                  {hint(l.sources.rate)}
                </td>
                <td className="p-1 whitespace-nowrap">
                  <Input
                    className="inline-block h-7 w-20"
                    type="number"
                    min={0}
                    step={1}
                    value={l.annualUnits ?? ""}
                    aria-label="Units per year"
                    onChange={(e) => set(i, { annualUnits: num(e.target.value) })}
                  />
                  {hint(l.sources.annualUnits)}
                </td>
                <td className="p-1 whitespace-nowrap">
                  <Input
                    className="inline-block h-7 w-36"
                    type="date"
                    value={l.start ?? ""}
                    aria-label="Starts"
                    onChange={(e) => set(i, { start: e.target.value || null })}
                  />
                  {hint(l.sources.start)}
                </td>
                <td className="p-1 whitespace-nowrap">
                  <Input
                    className="inline-block h-7 w-36"
                    type="date"
                    value={l.end ?? ""}
                    aria-label="Ends"
                    onChange={(e) => set(i, { end: e.target.value || null })}
                  />
                  {hint(l.sources.end)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
