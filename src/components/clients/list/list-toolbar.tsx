import type { ReactNode } from "react";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import type { ListFilters } from "@/lib/clients/list";

const ALL = "__all__";

type Option = { id: string; name: string };

/** Toolbar card: view tabs, search, home / team member / code filters and Export CSV. */
export function ListToolbar({
  tabs,
  showFilters,
  filters,
  onChange,
  codeOptions,
  homes,
  staffOptions,
  onExport,
  exportDisabled,
}: {
  tabs: ReactNode;
  /** False on the Referrals view: only the tabs show. */
  showFilters: boolean;
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  codeOptions: string[];
  homes: Option[];
  staffOptions: Option[];
  onExport: () => void;
  exportDisabled: boolean;
}) {
  const chip = (active: boolean) =>
    "min-h-8 rounded-full border px-3 py-1 font-mono text-xs transition-colors max-md:min-h-11 " +
    (active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-hive-border bg-hive-surface text-muted-foreground hover:text-foreground");
  return (
    <SectionCard
      icon={SlidersHorizontal}
      title="Find a client"
      description="Search by name or ID, filter by home, team member or code, or export what you see."
      actions={
        showFilters ? (
          <Button type="button" variant="outline" disabled={exportDisabled} onClick={onExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        {tabs}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => onChange({ search: e.target.value })}
                placeholder="Search by name, Medicaid ID or PID..."
                className="h-10 pl-9 text-sm max-md:h-11"
              />
            </div>
            {homes.length > 0 && (
              <Select
                value={filters.homeId ?? ALL}
                onValueChange={(v) => onChange({ homeId: v === ALL ? null : v })}
              >
                <SelectTrigger
                  className="h-10 w-full text-sm sm:w-[160px] max-md:h-11"
                  aria-label="Home"
                >
                  <SelectValue placeholder="All homes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All homes</SelectItem>
                  {homes.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {staffOptions.length > 0 && (
              <Select
                value={filters.staffId ?? ALL}
                onValueChange={(v) => onChange({ staffId: v === ALL ? null : v })}
              >
                <SelectTrigger
                  className="h-10 w-full text-sm sm:w-[180px] max-md:h-11"
                  aria-label="Team member"
                >
                  <SelectValue placeholder="Any team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any team member</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {showFilters && codeOptions.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Service code"
          >
            <button
              type="button"
              className={chip(!filters.code)}
              onClick={() => onChange({ code: null })}
            >
              All codes
            </button>
            {codeOptions.map((c) => (
              <button
                key={c}
                type="button"
                className={chip(filters.code === c)}
                aria-pressed={filters.code === c}
                onClick={() => onChange({ code: filters.code === c ? null : c })}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
