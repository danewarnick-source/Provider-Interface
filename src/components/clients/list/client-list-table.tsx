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
  CodeBadges,
  NextDueCell,
  ReadinessTag,
  StaffCell,
  UnitsLeftCell,
} from "./list-cells";

export function ClientListTable({
  rows,
  discharged,
  canEditClients,
  reactivate,
  onOpenClient,
  onOpenDraft,
}: ClientListViewProps) {
  return (
    <div className="hidden max-h-[calc(100vh-18rem)] overflow-auto md:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Codes</TableHead>
            <TableHead>Home</TableHead>
            <TableHead>Units left</TableHead>
            <TableHead>Next due</TableHead>
            <TableHead>Team members</TableHead>
            <TableHead>{discharged ? "" : "Ready"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const draft = c.kind === "draft";
            const name = `${c.first_name} ${c.last_name}`.trim();
            return (
              <TableRow
                key={c.id}
                data-testid={draft ? "client-draft-row" : "client-row"}
                className="h-12 cursor-pointer transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  if (isRowControlClick(e.target)) return;
                  if (draft) onOpenDraft(c.id);
                  else onOpenClient(c.id);
                }}
              >
                <TableCell className="whitespace-nowrap p-0 font-medium">
                  {draft ? (
                    <button
                      type="button"
                      onClick={() => onOpenDraft(c.id)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left"
                    >
                      <ClientAvatar row={c} />
                      <span className="truncate">{name}</span>
                    </button>
                  ) : (
                    <Link
                      to="/dashboard/clients/$clientId"
                      params={{ clientId: c.id }}
                      search={{ tab: "overview" }}
                      className="flex w-full items-center gap-2 rounded-sm px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ClientAvatar row={c} />
                      <span className="truncate">{name}</span>
                    </Link>
                  )}
                </TableCell>
                <TableCell className="py-2">
                  <CodeBadges codes={c.codes} />
                </TableCell>
                <TableCell className="max-w-[160px] truncate py-2 text-sm text-muted-foreground">
                  {c.home?.name ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap py-2">
                  <UnitsLeftCell row={c} />
                </TableCell>
                <TableCell className="whitespace-nowrap py-2">
                  <NextDueCell row={c} />
                </TableCell>
                <TableCell className="max-w-[180px] truncate py-2">
                  <StaffCell row={c} />
                </TableCell>
                <TableCell className="py-2 text-right" data-no-row-nav>
                  {discharged ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={!canEditClients || reactivate.isPending}
                      onClick={() => reactivate.mutate(c.id)}
                    >
                      {reactivate.isPending && reactivate.variables === c.id && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Reactivate
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
