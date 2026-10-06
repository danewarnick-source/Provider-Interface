import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { jobCodeLabel } from "@/lib/job-codes";
import { IntakeAction, IntakeChip } from "./intake-chip";
import { clientFullName, isRowControlClick, type ClientListViewProps } from "./client-list-types";

export function ClientListTable({
  rows, rosterTab, organizationId, canEditClients, reactivate, onOpenClient, onOpenIntake,
}: ClientListViewProps) {
  return (
    <div className="hidden max-h-[calc(100vh-16rem)] overflow-auto md:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Medicaid ID</TableHead>
            <TableHead>Service Codes</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
            <TableHead className="w-[110px]">Intake</TableHead>
            <TableHead className="text-right w-[160px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const codes = c.job_code ?? [];
            const shownCodes = codes.slice(0, 3);
            const extraCodes = codes.length - shownCodes.length;
            return (
              <TableRow
                key={c.id}
                className="cursor-pointer h-12 hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  if (e.defaultPrevented) return;
                  if (isRowControlClick(e.target)) return;
                  onOpenClient(c.id);
                }}
              >
                <TableCell className="font-medium whitespace-nowrap p-0">
                  <Link
                    to="/dashboard/clients/$clientId"
                    params={{ clientId: c.id }}
                    search={{ tab: "overview" }}
                    className="flex items-center gap-2 px-4 py-2 w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {c.first_name?.[0] ?? ""}{c.last_name?.[0] ?? ""}
                    </span>
                    <span className="truncate">{c.first_name} {c.last_name}</span>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap py-2">
                  {c.medicaid_id || "—"}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {shownCodes.length ? (
                      <>
                        {shownCodes.map((code) => (
                          <Badge key={code} variant="outline" className="font-mono text-[10px]"
                            title={jobCodeLabel(code)}>{code}</Badge>
                        ))}
                        {extraCodes > 0 && (
                          <Badge variant="secondary" className="text-[10px]" title={codes.slice(3).join(", ")}>
                            +{extraCodes}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap py-2">
                  {c.phone_number || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground py-2 max-w-[220px]">
                  <div className="truncate" title={c.physical_address ?? undefined}>
                    {c.physical_address || "—"}
                  </div>
                </TableCell>
                <TableCell className="py-2 w-[110px]" data-no-row-nav onClick={(e) => e.stopPropagation()}>
                  <IntakeChip
                    organizationId={organizationId}
                    clientId={c.id}
                    intakeStatus={c.intake_status}
                    onClick={() => onOpenIntake({ id: c.id, name: clientFullName(c) })}
                  />
                </TableCell>
                <TableCell className="text-right py-2 w-[220px]" data-no-row-nav onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {rosterTab === "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!canEditClients || reactivate.isPending}
                        onClick={(e) => { e.stopPropagation(); reactivate.mutate(c.id); }}
                      >
                        {reactivate.isPending && reactivate.variables === c.id
                          ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          : null}
                        Reactivate
                      </Button>
                    ) : (
                      <>
                        <IntakeAction
                          organizationId={organizationId}
                          clientId={c.id}
                          intakeStatus={c.intake_status}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to="/dashboard/clients/$clientId"
                            params={{ clientId: c.id }}
                            search={{ tab: "overview" }}
                          >
                            View <ChevronRight className="ml-0.5 h-3 w-3" />
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
