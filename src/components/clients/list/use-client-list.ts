import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listClients } from "@/lib/clients/list.functions";
import { reactivateClient } from "@/lib/clients/discharge.functions";
import type { ListFilters } from "@/lib/clients/list";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** The client list: one server call per filter change (search is debounced). */
export function useClientList(organizationId: string | undefined, filters: ListFilters) {
  const qc = useQueryClient();
  const search = useDebounced(filters.search.trim(), 250);
  const listFn = useServerFn(listClients);
  const query = useQuery({
    enabled: !!organizationId,
    queryKey: ["clients", "list", organizationId, { ...filters, search }],
    placeholderData: keepPreviousData,
    queryFn: () =>
      listFn({
        data: {
          organizationId: organizationId!,
          view: filters.view,
          search,
          code: filters.code,
          homeId: filters.homeId,
          staffId: filters.staffId,
          needsAttention: filters.needsAttention,
        },
      }),
  });

  const reactivateFn = useServerFn(reactivateClient);
  const reactivate = useMutation({
    mutationFn: async (clientId: string) => {
      await reactivateFn({ data: { organizationId: organizationId!, clientId } });
      return clientId;
    },
    onSuccess: () => {
      toast.success("Client reactivated.");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { query, searching: search !== filters.search.trim(), reactivate };
}
