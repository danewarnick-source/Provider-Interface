// Loads one client's file from Evidence and keeps it in step with their codes:
// when the saved file is behind (a code was added or ended) and the viewer can
// change what's required, it catches up once, then reloads.

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadClientFile, syncClientFile } from "@/lib/clients/file-evidence.functions";

export const clientFileKey = (clientId: string) => ["client-file", clientId] as const;

export function useClientFile(orgId: string, clientId: string, canManage: boolean) {
  const qc = useQueryClient();
  const loadFn = useServerFn(loadClientFile);
  const syncFn = useServerFn(syncClientFile);
  const q = useQuery({
    queryKey: clientFileKey(clientId),
    enabled: !!orgId,
    queryFn: () => loadFn({ data: { organizationId: orgId, clientId } }),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: clientFileKey(clientId) });
    void qc.invalidateQueries({ queryKey: ["client-overview"] });
    void qc.invalidateQueries({ queryKey: ["evidence-board", orgId] });
  };

  const synced = useRef(false);
  const pending = q.data?.pending === true;
  useEffect(() => {
    if (!canManage || !pending || synced.current) return;
    synced.current = true;
    syncFn({ data: { organizationId: orgId, clientId } })
      .then(refresh)
      .catch(() => {
        /* the file still shows what's needed; the next admin visit tries again */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, pending, orgId, clientId]);

  return { q, refresh };
}
