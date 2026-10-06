// Picks which of the client's codes one team member is assigned. The list is
// always explicit: never "all codes".

import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CodeScopePopover({
  authorized,
  value,
  onChange,
  disabled,
}: {
  authorized: string[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const picked = new Set(value);
  const allPicked = authorized.length > 0 && authorized.every((c) => picked.has(c));

  function toggle(code: string) {
    const next = new Set(picked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Keep the client's code order. Empty is allowed here; Save blocks it.
    onChange(authorized.filter((c) => next.has(c)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={disabled}
        >
          <Tag className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{value.length ? value.join(", ") : "No codes"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="px-1 pb-1 text-xs font-medium">Service codes</div>
        <button
          type="button"
          className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
          disabled={allPicked}
          onClick={() => onChange([...authorized])}
        >
          Select all ({authorized.length})
        </button>
        <div className="my-1 h-px bg-border" />
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {authorized.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
            >
              <Checkbox checked={picked.has(c)} onCheckedChange={() => toggle(c)} />
              <span className="font-mono">{c}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
