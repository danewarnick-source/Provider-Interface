// The agency's team members (active members with an active profile), sorted
// by name. Two queries joined in JS: organization_members and profiles have
// no FK between them, so they are never embedded.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgStaff = { id: string; name: string };

type ProfileName = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  is_active: boolean | null;
};

function profileName(p: Pick<ProfileName, "first_name" | "last_name" | "full_name">): string {
  return (
    p.full_name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    "Team member"
  );
}

export function useOrgStaff(orgId: string | undefined) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["org-staff", orgId],
    staleTime: 60_000,
    queryFn: async (): Promise<OrgStaff[]> => {
      const { data: members, error: mErr } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId!)
        .eq("active", true);
      if (mErr) throw mErr;
      const ids = (members ?? [])
        .map((m) => (m as { user_id: string | null }).user_id)
        .filter((x): x is string => !!x);
      if (ids.length === 0) return [];
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name, is_active")
        .in("id", ids);
      if (pErr) throw pErr;
      return ((profs ?? []) as ProfileName[])
        .filter((p) => p.is_active !== false)
        .map((p) => ({ id: p.id, name: profileName(p) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** Names for any profile ids (including people no longer active). */
export function useProfileNames(ids: readonly string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    enabled: key.length > 0,
    queryKey: ["profile-names", key],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name")
        .in("id", key);
      if (error) throw error;
      return new Map(((data ?? []) as ProfileName[]).map((p) => [p.id, profileName(p)] as const));
    },
  });
}
