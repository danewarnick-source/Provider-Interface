import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { jobCodeLabel } from "@/lib/job-codes";
import { formatDate } from "@/lib/clients/dates";
import { LOW_UNITS_PCT, DUE_SOON_DAYS, type ClientListRow } from "@/lib/clients/list";

export function ClientAvatar({ row, size = "sm" }: { row: ClientListRow; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[11px]";
  if (row.photo_url) {
    return (
      <img src={row.photo_url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary`}
    >
      {row.first_name?.[0] ?? ""}
      {row.last_name?.[0] ?? ""}
    </span>
  );
}

export function CodeBadges({ codes, max = 4 }: { codes: string[]; max?: number }) {
  if (!codes.length) return <span className="text-xs text-muted-foreground">No codes</span>;
  const shown = codes.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((code) => (
        <Badge
          key={code}
          variant="outline"
          className="font-mono text-[10px]"
          title={jobCodeLabel(code)}
        >
          {code}
        </Badge>
      ))}
      {codes.length > max && (
        <Badge variant="secondary" className="text-[10px]" title={codes.slice(max).join(", ")}>
          +{codes.length - max}
        </Badge>
      )}
    </div>
  );
}

export function UnitsLeftCell({ row }: { row: ClientListRow }) {
  const u = row.unitsLeft;
  if (!u) return <span className="text-xs text-muted-foreground">—</span>;
  const low = u.pct <= LOW_UNITS_PCT;
  return (
    <span
      className={`text-xs tabular-nums ${low ? "font-semibold text-rose-700 dark:text-rose-400" : "text-muted-foreground"}`}
      title={`${u.code}: ${u.left.toLocaleString()} of ${u.annual.toLocaleString()} units left`}
    >
      <span className="font-mono">{u.code}</span> {u.left.toLocaleString()} left
    </span>
  );
}

export function NextDueCell({ row }: { row: ClientListRow }) {
  const d = row.nextDue;
  if (!d) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    d.days < 0
      ? "text-rose-700 dark:text-rose-400 font-semibold"
      : d.days <= DUE_SOON_DAYS
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <span className={`text-xs ${tone}`}>
      {d.label} · {formatDate(d.date, { month: "short", day: "numeric" })}
      {d.days < 0 ? " (overdue)" : ""}
    </span>
  );
}

export function StaffCell({ row }: { row: ClientListRow }) {
  if (!row.staff.length) return <span className="text-xs text-muted-foreground">None</span>;
  const names = row.staff.map((s) => s.name);
  return (
    <span className="text-xs text-muted-foreground" title={names.join(", ")}>
      {names.slice(0, 2).join(", ")}
      {names.length > 2 ? ` +${names.length - 2}` : ""}
    </span>
  );
}

export function ReadinessTag({ row }: { row: ClientListRow }) {
  if (row.kind === "draft") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <Wrench className="h-3 w-3" /> Finish setup
      </span>
    );
  }
  if (row.readiness.ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Ready
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      title={row.readiness.missing.join("\n")}
    >
      <AlertTriangle className="h-3 w-3" /> {row.readiness.missing.length} to fix
    </span>
  );
}
