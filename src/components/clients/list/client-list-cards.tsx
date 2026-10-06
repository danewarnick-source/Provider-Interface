import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRowControlClick, type ClientListViewProps } from "./client-list-types";
import { ClientAvatar, CodeBadges, NextDueCell, ReadinessTag, UnitsLeftCell } from "./list-cells";

/** Phone layout: the same rows as stacked cards. */
export function ClientListCards({
  rows,
  discharged,
  canEditClients,
  reactivate,
  onOpenClient,
  onOpenDraft,
}: ClientListViewProps) {
  return (
    <div className="block divide-y divide-border md:hidden">
      {rows.map((c) => {
        const open = () => (c.kind === "draft" ? onOpenDraft(c.id) : onOpenClient(c.id));
        return (
          <div
            key={c.id}
            className="flex cursor-pointer flex-col gap-2 p-4 active:bg-muted/50"
            onClick={(e) => {
              if (!isRowControlClick(e.target)) open();
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ClientAvatar row={c} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {c.first_name} {c.last_name}
                  </p>
                  {c.home && (
                    <p className="truncate text-xs text-muted-foreground">{c.home.name}</p>
                  )}
                </div>
              </div>
              {!discharged && <ReadinessTag row={c} />}
            </div>
            {c.kind === "client" && <CodeBadges codes={c.codes} max={6} />}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <UnitsLeftCell row={c} />
              <NextDueCell row={c} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1" data-no-row-nav>
              {discharged ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={!canEditClients || reactivate.isPending}
                  onClick={() => reactivate.mutate(c.id)}
                >
                  {reactivate.isPending && reactivate.variables === c.id && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Reactivate
                </Button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={open}
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                {c.kind === "draft" ? "Finish setup" : "Open"}{" "}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
