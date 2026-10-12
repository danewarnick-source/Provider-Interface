import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isRowControlClick, type ClientListViewProps } from "./client-list-types";
import {
  ClientAvatar,
  CodesCell,
  HomeCell,
  NameBlock,
  NextDueCell,
  ReadinessTag,
  StaffCell,
  UnitsLeftCell,
} from "./list-cells";

/** Desktop table; the whole row opens the profile. Scrolls inside its own box. */
export function ClientListTable({
  rows,
  discharged,
  canEditClients,
  viewer,
  reactivate,
  onOpenClient,
}: ClientListViewProps) {
  return (
    <div className="hidden max-h-[calc(100vh-18rem)] overflow-auto md:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[var(--hive-muted-surface)]">
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Codes</TableHead>
            <TableHead>Home</TableHead>
            <TableHead>Units left</TableHead>
            <TableHead>Next due</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">{discharged ? "" : "Readiness"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const inner = (
              <>
                <ClientAvatar row={c} />
                <NameBlock row={c} />
              </>
            );
            const cellBox = "flex w-full items-center gap-3 px-4 py-2 text-left";
            return (
              <TableRow
                key={c.id}
                data-testid="client-row"
                className="h-14 cursor-pointer transition-colors hover:bg-[var(--hive-muted-surface)]"
                onClick={(e) => {
                  if (isRowControlClick(e.target)) return;
                  onOpenClient(c.id);
                }}
              >
                <TableCell className="min-w-[200px] p-0">
                  <Link
                    to="/dashboard/clients/$clientId"
                    params={{ clientId: c.id }}
                    search={{}}
                    className={`${cellBox} rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  >
                    {inner}
                  </Link>
                </TableCell>
                <TableCell className="py-2">
                  <CodesCell row={c} viewer={viewer} />
                </TableCell>
                <TableCell className="max-w-[160px] truncate py-2">
                  <HomeCell row={c} viewer={viewer} />
                </TableCell>
                <TableCell className="whitespace-nowrap py-2">
                  <UnitsLeftCell row={c} viewer={viewer} />
                </TableCell>
                <TableCell className="whitespace-nowrap py-2">
                  <NextDueCell row={c} />
                </TableCell>
                <TableCell className="max-w-[180px] truncate py-2">
                  <StaffCell row={c} viewer={viewer} />
                </TableCell>
                <TableCell className="py-2 text-right" data-no-row-nav={discharged || undefined}>
                  {discharged ? (
                    <Button
                      variant="outline"
                      disabled={!canEditClients || reactivate.isPending}
                      onClick={() => reactivate.mutate(c.id)}
                    >
                      {reactivate.isPending && reactivate.variables === c.id && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Reactivate client
                    </Button>
                  ) : (
                    <ReadinessTag row={c} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
