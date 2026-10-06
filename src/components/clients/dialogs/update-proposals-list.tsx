// The review list inside "Update from a document": each proposed field with
// its current value and the value from the document; nothing is written
// until the person ticks rows and clicks Apply selected.

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export type UpdateProposal = {
  field_key: string;
  label: string;
  incomingValue: string;
  currentValue: string | null;
  changed: boolean;
  confidence: number;
  field: {
    field_key: string;
    value_text?: string | null;
    value_number?: number | null;
    value_date?: string | null;
    value_bool?: boolean | null;
    value_array?: string[] | null;
    value_json?: unknown;
    confidence?: number | null;
  };
};

export function UpdateProposalsList({
  proposals,
  checked,
  onCheckedChange,
}: {
  proposals: UpdateProposal[];
  checked: Record<string, boolean>;
  onCheckedChange: (fieldKey: string, value: boolean) => void;
}) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Nectar didn't find any profile fields to update from this document.
      </div>
    );
  }
  return (
    <>
      <div className="text-xs text-muted-foreground">
        Review the proposed changes. Rows where the document differs from the current value are
        ticked. Untick anything you don't want applied.
      </div>
      <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
        {proposals.map((p) => (
          <label
            key={p.field_key}
            className={`flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40 ${p.changed ? "bg-amber-50/50" : ""}`}
          >
            <Checkbox
              className="mt-1"
              checked={!!checked[p.field_key]}
              onCheckedChange={(v) => onCheckedChange(p.field_key, v === true)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{p.label}</span>
                <Badge
                  variant="outline"
                  className={
                    p.changed ? "border-amber-300 text-[10px] text-amber-700" : "text-[10px]"
                  }
                >
                  {p.changed ? "changed" : "unchanged"}
                </Badge>
              </div>
              <div className="mt-1 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Current</div>
                  <div className="break-words">
                    {p.currentValue ?? <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">From document</div>
                  <div className="break-words">{p.incomingValue}</div>
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>
    </>
  );
}
