import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { cn } from "@/lib/utils";
import { jobCodeLabel } from "@/lib/job-codes";
import { goesByLine } from "@/lib/clients/profile-header";
import type { ClientListRow } from "@/lib/clients/list";
import {
  canFixSection,
  codesCell,
  dueTone,
  nextDueText,
  readinessTag,
  unitsLow,
  unitsShortcut,
  type ListViewer,
} from "@/lib/clients/list-display";
import { EmptyCell, SectionLink } from "./list-shortcut";

type CellProps = { row: ClientListRow; viewer: ListViewer };

export function ClientAvatar({ row, size = "sm" }: { row: ClientListRow; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-10 w-10 text-xs" : "h-8 w-8 text-[11px]";
  if (row.photo_url) {
    return (
      <img src={row.photo_url} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-hive-ink font-bold text-white`}
    >
      {row.first_name?.[0] ?? ""}
      {row.last_name?.[0] ?? ""}
    </span>
  );
}

/** Name with "Goes by …" under it when the client has a preferred name. */
export function NameBlock({ row }: { row: ClientListRow }) {
  const goesBy = goesByLine({
    preferredName: row.preferred_name,
    firstName: row.first_name,
    age: null,
    home: null,
  });
  return (
    <span className="min-w-0">
      <span className="block truncate font-semibold text-hive-ink">
        {`${row.first_name} ${row.last_name}`.trim()}
      </span>
      {goesBy ? (
        <span className="block truncate text-xs font-normal text-muted-foreground">{goesBy}</span>
      ) : null}
    </span>
  );
}

function CodePills({ codes, max, dim }: { codes: string[]; max: number; dim?: boolean }) {
  return (
    <>
      {codes.slice(0, max).map((code) => (
        <Badge
          key={code}
          variant="outline"
          className={cn("bg-hive-surface font-mono text-[10px]", dim && "opacity-60")}
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
    </>
  );
}

/** Active codes; ended codes dimmed with "Ended Aug 31 · Renew"; or "+ Add codes". */
export function CodesCell({ row, viewer, max = 4 }: CellProps & { max?: number }) {
  const cell = codesCell(row);
  if (cell.kind === "none") {
    return <EmptyCell row={row} viewer={viewer} shortcut="codes" fallback="No codes" />;
  }
  if (cell.kind === "active") {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <CodePills codes={cell.codes} max={max} />
      </div>
    );
  }
  const canRenew = canFixSection(cell.section, viewer);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <CodePills codes={cell.codes} max={max} dim />
      {canRenew ? (
        <SectionLink
          clientId={row.id}
          section={cell.section}
          className="rounded-full border border-hive-gold bg-hive-gold-soft px-2 text-hive-ink"
        >
          {cell.status} · Renew
        </SectionLink>
      ) : (
        <StatusTag tone="profile">{cell.status}</StatusTag>
      )}
    </div>
  );
}

export function HomeCell({ row, viewer }: CellProps) {
  if (row.home) {
    return <span className="text-sm text-muted-foreground">{row.home.name}</span>;
  }
  return <EmptyCell row={row} viewer={viewer} shortcut="home" fallback="—" />;
}

export function UnitsLeftCell({ row, viewer }: CellProps) {
  const u = row.unitsLeft;
  if (!u) return <EmptyCell row={row} viewer={viewer} shortcut={unitsShortcut(row)} fallback="—" />;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        unitsLow(row) ? "font-semibold text-[var(--hive-danger-fg)]" : "text-muted-foreground",
      )}
      title={`${u.code}: ${u.left.toLocaleString()} of ${u.annual.toLocaleString()} units left`}
    >
      <span className="font-mono">{u.code}</span> {u.left.toLocaleString()} left
    </span>
  );
}

export function NextDueCell({ row }: { row: ClientListRow }) {
  const d = row.nextDue;
  if (!d) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = dueTone(d);
  if (tone === "normal")
    return <span className="text-xs text-muted-foreground">{nextDueText(d)}</span>;
  return <StatusTag tone={tone === "overdue" ? "danger" : "profile"}>{nextDueText(d)}</StatusTag>;
}

export function StaffCell({ row, viewer }: CellProps) {
  if (!row.staff.length) {
    return <EmptyCell row={row} viewer={viewer} shortcut="team" fallback="None" />;
  }
  const names = row.staff.map((s) => s.name);
  return (
    <span className="text-xs text-muted-foreground" title={names.join(", ")}>
      {names.slice(0, 2).join(", ")}
      {names.length > 2 ? ` +${names.length - 2}` : ""}
    </span>
  );
}

const TAG_ICON = { ok: CheckCircle2, danger: AlertTriangle } as const;

export function ReadinessTag({ row }: { row: ClientListRow }) {
  const tag = readinessTag(row);
  const Icon = TAG_ICON[tag.tone];
  return (
    <StatusTag tone={tag.tone} title={tag.title} testId="client-readiness-tag">
      <Icon className="h-3 w-3" aria-hidden /> {tag.text}
    </StatusTag>
  );
}
