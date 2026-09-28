import {
  ClipboardCheck,
  KeyRound,
  Mail,
  MoreHorizontal,
  RefreshCcw,
  UserCheck,
  UserRound,
  Users,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RosterActionKey, RosterRow } from "@/lib/team-members/roster";

export type RosterActionHandler = (key: RosterActionKey, row: RosterRow) => void;

const META: Record<RosterActionKey, { label: string; icon: LucideIcon; destructive?: boolean }> = {
  open: { label: "Open profile", icon: UserRound },
  evidence: { label: "Review evidence pack", icon: ClipboardCheck },
  caseload: { label: "Edit caseload", icon: Users },
  reset_password: { label: "Reset password…", icon: KeyRound },
  send_invite: { label: "Send invite", icon: Mail },
  resend_invite: { label: "Resend invite", icon: RefreshCcw },
  deactivate: { label: "Deactivate…", icon: UserX, destructive: true },
  reactivate: { label: "Reactivate", icon: UserCheck },
};

/** Desktop ⋯ dropdown. */
export function RowActionsMenu({
  row,
  keys,
  onAction,
}: {
  row: RosterRow;
  keys: RosterActionKey[];
  onAction: RosterActionHandler;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={`More actions for ${row.displayName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {keys.map((key) => {
          const meta = META[key];
          const Icon = meta.icon;
          return (
            <div key={key}>
              {meta.destructive && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={() => onAction(key, row)}
                className={meta.destructive ? "text-destructive focus:text-destructive" : undefined}
              >
                <Icon className="mr-2 h-3.5 w-3.5" /> {meta.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mobile: the same items in a bottom sheet. */
export function RowActionsSheet({
  row,
  keys,
  onAction,
  onClose,
}: {
  row: RosterRow | null;
  keys: RosterActionKey[];
  onAction: RosterActionHandler;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="truncate text-left">{row?.displayName ?? ""}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 grid gap-1">
          {row &&
            keys.map((key) => {
              const meta = META[key];
              const Icon = meta.icon;
              return (
                <Button
                  key={key}
                  variant="ghost"
                  className={
                    "h-11 justify-start text-sm" +
                    (meta.destructive ? " text-destructive hover:text-destructive" : "")
                  }
                  onClick={() => {
                    onClose();
                    onAction(key, row);
                  }}
                >
                  <Icon className="mr-3 h-4 w-4" /> {meta.label}
                </Button>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
