// Settings → Recently deleted (Owners): clients and team members deleted as
// made by mistake, who deleted them, when and why, with Restore. Nothing was
// erased, so Restore brings everything back. Server: lib/people/delete.functions.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import {
  listRecentlyDeleted,
  restorePerson,
  type DeletedPerson,
} from "@/lib/people/delete.functions";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function RecentlyDeletedList({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecentlyDeleted);
  const restoreFn = useServerFn(restorePerson);
  const key = ["recently-deleted", orgId] as const;
  const list = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { organizationId: orgId } }),
  });

  const restore = useMutation({
    mutationFn: (p: DeletedPerson) =>
      restoreFn({ data: { organizationId: orgId, kind: p.kind, id: p.id } }),
    onSuccess: (r, p) => {
      toast.success(
        p.kind === "client"
          ? `${r.name} is back on the client list.`
          : `${r.name} is back as an inactive team member. Reactivate them on their profile to let them sign in.`,
      );
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];

  return (
    <SectionCard
      icon={Trash2}
      title="Recently deleted"
      description="Clients and team members deleted because they were added by mistake. Nothing was erased; Restore brings them back."
      testId="recently-deleted"
    >
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <EmptyState>No one has been deleted.</EmptyState>
      ) : (
        <ul className="divide-y divide-hive-border">
          {rows.map((p) => (
            <li
              key={`${p.kind}-${p.id}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
              data-testid="recently-deleted-row"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-hive-ink">{p.name}</span>
                  <StatusTag>{p.kind === "client" ? "Client" : "Team member"}</StatusTag>
                </div>
                <p className="text-sm text-muted-foreground">
                  Deleted by {p.deletedByName} on {when(p.deletedAt)}
                  {p.reason ? ` · ${p.reason}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                className="max-md:min-h-11"
                disabled={restore.isPending}
                onClick={() => restore.mutate(p)}
              >
                Restore {p.name}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
