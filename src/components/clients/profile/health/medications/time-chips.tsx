// The times a scheduled medication is given, as removable chips.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime12, sortedTimes } from "@/lib/medications/med-display";

export function TimeChips({
  times,
  onChange,
}: {
  times: string[];
  onChange: (t: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft) return;
    onChange(sortedTimes([...times, draft]));
    setDraft("");
  };
  return (
    <div className="space-y-2" data-testid="med-time-chips">
      <div className="flex flex-wrap gap-1.5">
        {sortedTimes(times).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium"
          >
            {formatTime12(t)}
            <button
              type="button"
              aria-label={`Remove ${formatTime12(t)}`}
              onClick={() => onChange(times.filter((x) => sortedTimes([x])[0] !== t))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-36"
          aria-label="Time"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!draft}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add time
        </Button>
      </div>
    </div>
  );
}
