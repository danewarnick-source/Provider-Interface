// One section (income / expenses / other) of a client's monthly budget, and
// the totals tiles. Removing a line archives it (never deleted).

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt$, sortLines, type BudgetLine, type BudgetSection } from "./budget-model";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";

export function BudgetLinesTable({
  title,
  section,
  lines,
  canEdit,
  onAdd,
  onArchive,
  onPatch,
}: {
  title: string;
  section: BudgetSection;
  lines: BudgetLine[];
  canEdit: boolean;
  onAdd: () => void;
  onArchive: (id: string) => void;
  onPatch: (id: string, changes: Partial<BudgetLine>) => void;
}) {
  const subtotal = lines.reduce((a, l) => a + Number(l.non_variable) + Number(l.variable), 0);
  const money = (l: BudgetLine, key: "non_variable" | "variable") => (
    <Input
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      value={l[key]}
      disabled={!canEdit}
      className="text-right"
      onChange={(e) => onPatch(l.id, { [key]: Number(e.target.value) || 0 })}
    />
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            Subtotal: <span className="font-medium">{fmt$(subtotal)}</span>
          </div>
          {canEdit && (
            <Button variant="outline" onClick={onAdd}>
              <Plus className="h-4 w-4" /> Add line
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="w-[8%] py-1 pr-2 text-center">Day</th>
              <th className="w-[24%] py-1 pr-2">Label</th>
              <th className="w-[13%] py-1 pr-2 text-right">Non-variable</th>
              <th className="w-[13%] py-1 pr-2 text-right">Variable</th>
              <th className="w-[11%] py-1 pr-2 text-right">Total</th>
              <th className="w-[27%] py-1 pr-2">Notes</th>
              {canEdit && <th className="w-[4%] py-1" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={canEdit ? 7 : 6}
                  className="py-3 text-center text-xs text-muted-foreground"
                >
                  No {section} lines yet.
                </td>
              </tr>
            )}
            {sortLines(lines).map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    inputMode="numeric"
                    value={l.day_of_month ?? ""}
                    disabled={!canEdit}
                    placeholder="—"
                    className="text-center"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const n = Math.max(1, Math.min(31, Math.floor(Number(raw))));
                      onPatch(l.id, { day_of_month: raw === "" || !Number.isFinite(n) ? null : n });
                    }}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    value={l.label}
                    disabled={!canEdit}
                    placeholder="Label"
                    onChange={(e) => onPatch(l.id, { label: e.target.value })}
                  />
                </td>
                <td className="py-2 pr-2">{money(l, "non_variable")}</td>
                <td className="py-2 pr-2">{money(l, "variable")}</td>
                <td className="py-2 pr-2 text-right font-medium tabular-nums">
                  {fmt$(Number(l.non_variable) + Number(l.variable))}
                </td>
                <td className="py-2 pr-2">
                  <Input
                    value={l.notes ?? ""}
                    disabled={!canEdit}
                    placeholder="Notes"
                    onChange={(e) => onPatch(l.id, { notes: e.target.value })}
                  />
                </td>
                {canEdit && (
                  <td className="py-2 text-right">
                    <RowMenu
                      label="More actions for this line"
                      items={[
                        {
                          label: "Remove line (kept in the record)",
                          danger: true,
                          onSelect: () => onArchive(l.id),
                        },
                      ]}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TotalTile({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "danger";
  emphasize?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div
      className={`rounded-md border bg-background p-3 ${emphasize ? "ring-2 ring-primary/30" : ""}`}
    >
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div
        className={`mt-1 tabular-nums ${emphasize ? "text-2xl font-bold" : "text-lg font-semibold"} ${toneClass}`}
      >
        {fmt$(value)}
      </div>
    </div>
  );
}
