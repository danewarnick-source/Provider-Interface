// Page gate for one client's pages (workspace, HHS hub, client training).
// Allowed: Clients: View, or the client is on the viewer's own caseload
// (clients_for_staff — direct assignments plus their home). Anyone else is
// sent to /unauthorized, the same as RequirePermission.

import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-org";

export function ClientAccessGate({
  clientId,
  children,
}: {
  clientId: string;
  children: ReactNode;
}) {
  const { can, isLoading: accessLoading } = useAccess();
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();
  const navigate = useNavigate();
  const canViewClients = can("view_clients");
  const orgId = org?.organization_id;

  const caseloadQ = useQuery({
    enabled: !accessLoading && !canViewClients && !!orgId && !!user?.id,
    queryKey: ["client-access-gate", orgId, user?.id, clientId],
    queryFn: async (): Promise<boolean> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .rpc("clients_for_staff", {
          _org: orgId,
          _staff: user!.id,
        })
        .is("deleted_at", null);
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string }>).some((c) => c.id === clientId);
    },
  });

  const allowed = canViewClients || caseloadQ.data === true;
  const deciding =
    accessLoading ||
    (!canViewClients &&
      (caseloadQ.isLoading || caseloadQ.data === undefined) &&
      !caseloadQ.isError);

  useEffect(() => {
    if (deciding || allowed) return;
    navigate({
      to: "/unauthorized",
      search: {
        perm: "view_clients",
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      },
    });
  }, [deciding, allowed, navigate]);

  if (deciding || !allowed) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}
