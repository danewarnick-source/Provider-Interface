import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRowControlClick, type ClientListViewProps } from "./client-list-types";
import {
  ClientAvatar,
  CodesCell,
  HomeCell,
  NameBlock,
  NextDueCell,
  ReadinessTag,
  UnitsLeftCell,
} from "./list-cells";

/** Phone layout: one card per client. */
export function ClientListCards({
  rows,
  discharged,
  canEditClients,
  viewer,
  reactivate,
  onOpenClient,
}: ClientListViewProps) {
  return (
    <ul className="flex flex-col gap-3 p-3 md:hidden">
      {rows.map((c) => {
        return (
          <li
            key={c.id}
            className="flex cursor-pointer flex-col gap-3 rounded-xl border border-hive-border bg-hive-surface p-4 active:bg-[var(--hive-muted-surface)]"
            onClick={(e) => {
              if (!isRowControlClick(e.target)) onOpenClient(c.id);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <ClientAvatar row={c} size="md" />
                <NameBlock row={c} />
              </div>
              {!discharged && <ReadinessTag row={c} />}
            </div>
            <CodesCell row={c} viewer={viewer} max={6} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Home</dt>
                <dd className="truncate">
                  <HomeCell row={c} viewer={viewer} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Units left</dt>
                <dd>
                  <UnitsLeftCell row={c} viewer={viewer} />
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-muted-foreground">Next due</dt>
                <dd>
                  <NextDueCell row={c} />
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center justify-end gap-2" data-no-row-nav>
              {discharged && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={!canEditClients || reactivate.isPending}
                  onClick={() => reactivate.mutate(c.id)}
                >
                  {reactivate.isPending && reactivate.variables === c.id && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Reactivate client
                </Button>
              )}
              <Button variant="outline" className="min-h-11" onClick={() => onOpenClient(c.id)}>
                Open profile <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
