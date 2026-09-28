import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/person/person-avatar";
import type { RosterActionKey, RosterRow } from "@/lib/team-members/roster";
import { EvidencePill } from "./evidence-status";
import { RowActionsSheet, type RosterActionHandler } from "./row-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LevelTag, MissingInfoChip, PendingFirstLoginChip, PositionText } from "./roster-table";

/** Roster below 768 px: tap a card for the profile, ⋯ for the actions sheet. */
export function RosterCards({
  rows,
  actionKeys,
  onAction,
}: {
  rows: RosterRow[];
  actionKeys: (row: RosterRow) => RosterActionKey[];
  onAction: RosterActionHandler;
}) {
  const navigate = useNavigate();
  const [sheetRow, setSheetRow] = useState<RosterRow | null>(null);
  return (
    <TooltipProvider delayDuration={150}>
      <ul className="block divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.memberId}>
            <div
              role="link"
              tabIndex={0}
              className="flex cursor-pointer items-center gap-3 p-4 active:bg-muted/50"
              onClick={() =>
                void navigate({
                  to: "/dashboard/team-members/$staffId",
                  params: { staffId: r.userId },
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void navigate({
                    to: "/dashboard/team-members/$staffId",
                    params: { staffId: r.userId },
                  });
                }
              }}
            >
              <PersonAvatar
                bucket="staff-photos"
                path={r.photoPath}
                name={r.displayName}
                className="h-10 w-10 shrink-0 text-xs"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{r.displayName}</span>
                  <LevelTag level={r.accessLevel} />
                </div>
                <div className="truncate text-xs">
                  <PositionText row={r} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <EvidencePill row={r} />
                  {r.mustChangePassword && <PendingFirstLoginChip />}
                  <MissingInfoChip row={r} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                aria-label={`More actions for ${r.displayName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetRow(r);
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <RowActionsSheet
        row={sheetRow}
        keys={sheetRow ? actionKeys(sheetRow) : []}
        onAction={onAction}
        onClose={() => setSheetRow(null)}
      />
    </TooltipProvider>
  );
}
