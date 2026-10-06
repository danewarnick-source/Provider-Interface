import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RosterFilter } from "@/lib/team-members/roster";
import { RosterFilterButtons } from "./roster-filter-buttons";

export type RosterView = "active" | "invited" | "inactive";
export type PickOption = { value: string; label: string };

/** Every toolbar value lives in the route's search params; this is the patch shape. */
export type RosterSearchPatch = {
  view?: RosterView;
  q?: string;
  filter?: RosterFilter | null;
  home?: string;
  position?: string;
  supervisor?: string;
};

const ALL = "__all";

export function RosterToolbar({
  view,
  counts,
  showInvited,
  showInactive,
  q,
  filter,
  filterCounts,
  home,
  position,
  supervisor,
  homeOptions,
  showHome,
  positionOptions,
  supervisorOptions,
  onChange,
}: {
  view: RosterView;
  counts: { active: number; invited: number; inactive: number };
  showInvited: boolean;
  showInactive: boolean;
  q: string;
  filter: RosterFilter | null;
  filterCounts: Record<RosterFilter, number>;
  home: string | undefined;
  position: string | undefined;
  supervisor: string | undefined;
  homeOptions: PickOption[];
  /** False when the org has no homes (teams). */
  showHome: boolean;
  positionOptions: PickOption[];
  supervisorOptions: PickOption[];
  onChange: (patch: RosterSearchPatch) => void;
}) {
  // Search types into local state and reaches the URL 150 ms after the last key.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => onChange({ q: text }), 150);
    return () => clearTimeout(t);
  }, [text, q, onChange]);

  const segments: Array<{ key: RosterView; label: string; show: boolean }> = [
    { key: "active", label: "Active", show: true },
    { key: "invited", label: `Invited (${counts.invited})`, show: showInvited },
    { key: "inactive", label: "Inactive", show: showInactive },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label="Roster view"
          className="inline-flex w-full rounded-md border border-border bg-muted/40 p-0.5 text-xs md:w-auto"
        >
          {segments
            .filter((s) => s.show)
            .map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={view === s.key}
                onClick={() => onChange({ view: s.key })}
                className={cn(
                  "flex-1 rounded px-3 py-1.5 font-medium transition-colors md:flex-none",
                  view === s.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
        </div>
        {view !== "invited" && (
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search name, email or team member ID"
              aria-label="Search team members"
              className="pl-9 pr-8"
            />
            {text && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setText("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {view === "active" && (
        <RosterFilterButtons filter={filter} counts={filterCounts} onChange={onChange} />
      )}

      {view !== "invited" && (
        <div className="grid gap-2 sm:grid-cols-3 md:flex md:flex-wrap">
          <Pick
            label="Position"
            allLabel="All positions"
            value={position}
            options={positionOptions}
            onChange={(v) => onChange({ position: v })}
          />
          {showHome && (
            <Pick
              label="Home"
              allLabel="All homes"
              value={home}
              options={homeOptions}
              onChange={(v) => onChange({ home: v })}
            />
          )}
          <Pick
            label="Supervisor"
            allLabel="All supervisors"
            value={supervisor}
            options={supervisorOptions}
            onChange={(v) => onChange({ supervisor: v })}
          />
        </div>
      )}
    </div>
  );
}

function Pick({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: PickOption[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className="h-9 w-full text-xs md:w-48" aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
