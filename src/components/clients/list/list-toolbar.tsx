import { AlertTriangle, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListFilters } from "@/lib/clients/list";

const ALL = "__all__";

type Option = { id: string; name: string };

export function ListToolbar({
  filters,
  onChange,
  codeOptions,
  homes,
  staffOptions,
  onExport,
  exportDisabled,
}: {
  filters: ListFilters;
  onChange: (patch: Partial<ListFilters>) => void;
  codeOptions: string[];
  homes: Option[];
  staffOptions: Option[];
  onExport: () => void;
  exportDisabled: boolean;
}) {
  const chip = (active: boolean) =>
    "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors " +
    (active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:text-foreground");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search by name, Medicaid ID or PID..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        {homes.length > 0 && (
          <Select
            value={filters.homeId ?? ALL}
            onValueChange={(v) => onChange({ homeId: v === ALL ? null : v })}
          >
            <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Home">
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
            <SelectTrigger className="h-9 w-[180px] text-sm" aria-label="Team member">
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
        <Button
          type="button"
          size="sm"
          variant={filters.needsAttention ? "default" : "outline"}
          className="h-9"
          aria-pressed={filters.needsAttention}
          onClick={() => onChange({ needsAttention: !filters.needsAttention })}
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Needs attention
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 sm:ml-auto"
          disabled={exportDisabled}
          onClick={onExport}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>
      {codeOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Service code">
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
  );
}
