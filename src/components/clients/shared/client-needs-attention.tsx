// A client's needs-attention list outside the profile (Smart Import done
// page): the same items as the profile Overview (lib/clients/readiness.ts),
// each linking to the profile section that fixes it.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrg } from "@/hooks/use-org";
import { getClientOverview } from "@/lib/clients/overview.functions";
import { clientOverviewKey } from "@/lib/clients/overview";
import { clientSectionSearchValue } from "@/lib/clients/profile-sections";

function useClientOverview(clientId: string) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const fn = useServerFn(getClientOverview);
  return useQuery({
    enabled: !!orgId,
    queryKey: clientOverviewKey(orgId, clientId),
    queryFn: () => fn({ data: { organizationId: orgId!, clientId } }),
    staleTime: 60_000,
  });
}

/** "Ready" when nothing needs attention, else how many things do. */
export function ClientReadyBadge({ clientId }: { clientId: string }) {
  const q = useClientOverview(clientId);
  if (!q.data) return <Badge variant="outline">checking…</Badge>;
  const n = q.data.attention.length;
  return n === 0 ? (
    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">ready</Badge>
  ) : (
    <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
      {n} to finish
    </Badge>
  );
}

export function ClientNeedsAttentionList({ clientId }: { clientId: string }) {
  const q = useClientOverview(clientId);
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Checking setup…</p>;
  if (q.isError || !q.data) return null;
  if (!q.data.attention.length) {
    return <p className="text-xs text-emerald-700">Nothing left to set up.</p>;
  }
  return (
    <ul className="space-y-1 text-sm" data-testid="client-needs-attention-list">
      {q.data.attention.map((a) => (
        <li key={a.key} className="flex flex-wrap items-baseline justify-between gap-2">
          <span>
            <span className={a.tone === "bad" ? "font-medium text-destructive" : "font-medium"}>
              {a.title}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">{a.detail}</span>
          </span>
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId }}
            search={{ section: clientSectionSearchValue(a.section) }}
            className="text-xs text-primary hover:underline"
          >
            Fix
          </Link>
        </li>
      ))}
    </ul>
  );
}
