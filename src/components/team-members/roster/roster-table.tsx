import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { PersonAvatar } from "@/components/person/person-avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatLastLogin,
  formatRosterDate,
  missingInfoText,
  positionSummary,
  rosterJobLine,
  type RosterActionKey,
  type RosterRow,
  type RosterSort,
  type RosterSortKey,
} from "@/lib/team-members/roster";
import { EvidenceBar } from "./evidence-status";
import { RowActionsMenu, type RosterActionHandler } from "./row-actions";

export function PendingFirstLoginChip() {
  return (
    <span className="hive-role-pill whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] uppercase">
      Pending first login
    </span>
  );
}

export function NeedsSetupChip() {
  return (
    <span
      data-testid="needs-setup-chip"
      className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      Needs setup
    </span>
  );
}

/** Owner / Admin badge beside the name. Team member (staff) shows nothing. */
export function LevelTag({ level }: { level: RosterRow["accessLevel"] }) {
  if (level === "staff") return null;
  return (
    <span
      data-testid="level-badge"
      className="shrink-0 rounded border border-border px-1 py-px text-[10px] font-medium uppercase text-muted-foreground"
    >
      {level === "owner" ? "Owner" : "Admin"}
    </span>
  );
}

/** "Missing info" chip; hover (or focus) lists what's missing. */
export function MissingInfoChip({ row }: { row: RosterRow }) {
  if (!row.missingInfo.length) return null;
  const text = missingInfoText(row.missingInfo);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-testid="missing-info-chip"
          aria-label={`Missing info: ${text}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 cursor-help rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
        >
          Missing info
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** Position: up to two labels, then "+N" (hover shows the rest). */
export function PositionText({ row }: { row: RosterRow }) {
  if (!row.positions.length) return <span className="text-muted-foreground">—</span>;
  const { shown, more } = positionSummary(row.positions);
  return (
    <span title={row.positions.map((p) => p.label).join(", ")}>
      {shown.join(", ")}
      {more > 0 && <span className="ml-1 text-muted-foreground">+{more}</span>}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: RosterSortKey;
  sort: RosterSort;
  onSort: (key: RosterSortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <th
      className="px-4 py-3 text-left font-semibold"
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
      >
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

/** Roster at 768 px and wider. */
export function RosterTable({
  rows,
  sort,
  onSort,
  actionKeys,
  onAction,
}: {
  rows: RosterRow[];
  sort: RosterSort;
  onSort: (key: RosterSortKey) => void;
  actionKeys: (row: RosterRow) => RosterActionKey[];
  onAction: RosterActionHandler;
}) {
  const navigate = useNavigate();
  return (
    <TooltipProvider delayDuration={150}>
      <div className="hidden max-h-[calc(100vh-16rem)] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/60">
            <tr>
              <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
              <th className="px-4 py-3 text-left font-semibold">Position</th>
              <th className="px-4 py-3 text-left font-semibold">Home · Supervisor</th>
              <SortHeader label="Evidence" sortKey="evidence" sort={sort} onSort={onSort} />
              <SortHeader label="Start date" sortKey="start" sort={sort} onSort={onSort} />
              <SortHeader label="Last login" sortKey="login" sort={sort} onSort={onSort} />
              <th className="w-12 px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const jobLine = rosterJobLine(r.jobTitle);
              return (
                <tr
                  key={r.memberId}
                  className="h-14 cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50"
                  onClick={() =>
                    void navigate({
                      to: "/dashboard/team-members/$staffId",
                      params: { staffId: r.userId },
                    })
                  }
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <PersonAvatar
                        bucket="staff-photos"
                        path={r.photoPath}
                        name={r.displayName}
                        className="h-9 w-9 text-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <Link
                            to="/dashboard/team-members/$staffId"
                            params={{ staffId: r.userId }}
                            className="truncate hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.displayName}
                          </Link>
                          <LevelTag level={r.accessLevel} />
                          {r.mustChangePassword && <PendingFirstLoginChip />}
                          {r.needsSetup && <NeedsSetupChip />}
                          <MissingInfoChip row={r} />
                        </div>
                        {jobLine && (
                          <div className="truncate text-xs font-normal text-muted-foreground">
                            {jobLine}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate whitespace-nowrap px-4 py-2 text-xs">
                    <PositionText row={r} />
                  </td>
                  <td className="max-w-[220px] px-4 py-2 text-xs">
                    <div className="truncate">{r.homeName ?? "No home"}</div>
                    <div className="truncate text-muted-foreground">
                      {r.supervisorName ?? "No supervisor"}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <EvidenceBar row={r} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {formatRosterDate(r.hireDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {formatLastLogin(r.lastSignInAt, r.lastSignInKnown)}
                  </td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu row={r} keys={actionKeys(r)} onAction={onAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
