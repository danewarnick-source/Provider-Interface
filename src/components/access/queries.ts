import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccessPresets, listAccessTargets } from "@/lib/access/access.functions";

export const accessKeys = {
  presets: (orgId: string) => ["access-presets", orgId] as const,
  targets: (orgId: string) => ["access-targets", orgId] as const,
  member: (orgId: string, userId: string) => ["member-access", orgId, userId] as const,
  team: (orgId: string) => ["team-access", orgId] as const,
  log: (orgId: string, page: number) => ["access-change-log", orgId, page] as const,
};

export function usePresets(orgId: string | undefined) {
  const fn = useServerFn(listAccessPresets);
  return useQuery({
    enabled: !!orgId,
    queryKey: accessKeys.presets(orgId ?? ""),
    queryFn: () => fn({ data: { organization_id: orgId! } }),
  });
}

export function useAccessTargets(orgId: string | undefined, enabled = true) {
  const fn = useServerFn(listAccessTargets);
  return useQuery({
    enabled: !!orgId && enabled,
    queryKey: accessKeys.targets(orgId ?? ""),
    queryFn: () => fn({ data: { organization_id: orgId! } }),
    staleTime: 60_000,
  });
}
