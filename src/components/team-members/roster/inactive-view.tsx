import { Link } from "@tanstack/react-router";
import { PersonAvatar } from "@/components/person/person-avatar";
import type { RosterActionKey, RosterRow } from "@/lib/team-members/roster";
import { RowActionsMenu, type RosterActionHandler } from "./row-actions";

/**
 * Inactive view. Last day, reason and rehire eligibility show "—" until the
 * offboarding columns land (prompt 5).
 */
export function InactiveView({
  rows,
  actionKeys,
  onAction,
}: {
  rows: RosterRow[];
  actionKeys: (row: RosterRow) => RosterActionKey[];
  onAction: RosterActionHandler;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Name</th>
            <th className="px-4 py-3 text-left font-semibold">Last day</th>
            <th className="px-4 py-3 text-left font-semibold">Reason</th>
            <th className="px-4 py-3 text-left font-semibold">Eligible for rehire</th>
            <th className="w-12 px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.memberId} className="border-b border-border/50">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <PersonAvatar
                    bucket="staff-photos"
                    path={r.photoPath}
                    name={r.displayName}
                    className="h-8 w-8 text-xs"
                  />
                  <Link
                    to="/dashboard/team-members/$staffId"
                    params={{ staffId: r.userId }}
                    className="truncate font-medium hover:underline"
                  >
                    {r.displayName}
                  </Link>
                </div>
              </td>
              <td className="px-4 py-2 text-muted-foreground">—</td>
              <td className="px-4 py-2 text-muted-foreground">—</td>
              <td className="px-4 py-2 text-muted-foreground">—</td>
              <td className="px-4 py-2 text-right">
                <RowActionsMenu row={r} keys={actionKeys(r)} onAction={onAction} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
