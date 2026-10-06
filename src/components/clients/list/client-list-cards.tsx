import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { jobCodeLabel } from "@/lib/job-codes";
import { IntakeAction, IntakeChip } from "./intake-chip";
import { clientFullName, isRowControlClick, type ClientListViewProps } from "./client-list-types";

/**
 * Mobile card list — the table overflows on small screens, so below md we
 * render the same rows as stacked cards instead.
 */
export function ClientListCards({
  rows, rosterTab, organizationId, canEditClients, reactivate, onOpenClient, onOpenIntake,
}: ClientListViewProps) {
  return (
    <div className="block divide-y divide-border md:hidden">
      {rows.map((c) => {
        const codes = c.codes;
        return (
          <div
            key={c.id}
            className="flex cursor-pointer flex-col gap-2 p-4 active:bg-muted/50"
            onClick={(e) => {
              if (isRowControlClick(e.target)) return;
              onOpenClient(c.id);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {c.first_name?.[0] ?? ""}{c.last_name?.[0] ?? ""}
                </span>
                <p className="truncate font-bold">{c.first_name} {c.last_name}</p>
              </div>
              {rosterTab !== "archived" && (
                <IntakeChip
                  organizationId={organizationId}
                  clientId={c.id}
                  intakeStatus={c.intake_status}
                  onClick={() => onOpenIntake({ id: c.id, name: clientFullName(c) })}
                />
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              Medicaid ID: {c.medicaid_id || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {codes.length ? (
                codes.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono text-[10px]" title={jobCodeLabel(code)}>
                    {code}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No service codes</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {rosterTab === "archived" ? (
                <div className="flex items-center gap-2" data-no-row-nav>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={!canEditClients || reactivate.isPending}
                    onClick={(e) => { e.stopPropagation(); reactivate.mutate(c.id); }}
                  >
                    {reactivate.isPending && reactivate.variables === c.id
                      ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      : null}
                    Reactivate
                  </Button>
                </div>
              ) : (
                <IntakeAction
                  organizationId={organizationId}
                  clientId={c.id}
                  intakeStatus={c.intake_status}
                />
              )}
              <Link
                to="/dashboard/clients/$clientId"
                params={{ clientId: c.id }}
                search={{ tab: "overview" }}
                className="flex items-center gap-1 text-sm font-medium text-primary"
                onClick={(e) => e.stopPropagation()}
              >
                View <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
