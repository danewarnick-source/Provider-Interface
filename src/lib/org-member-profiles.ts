import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type MemberProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
};

/**
 * Profiles of an org's active members. organization_members and profiles
 * have no foreign key between them (both key off auth.users.id), so
 * PostgREST can't embed one in the other — query both and join here.
 */
export async function activeMemberProfiles(
  supabase: SupabaseClient<Database> | SupabaseClient,
  organizationId: string,
): Promise<MemberProfile[]> {
  const { data: members, error } = await (supabase as SupabaseClient<Database>)
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  const ids = [...new Set((members ?? []).map((m) => m.user_id).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data: profiles, error: pErr } = await (supabase as SupabaseClient<Database>)
    .from("profiles")
    .select("id, first_name, last_name, full_name, email")
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);
  return (profiles ?? []) as MemberProfile[];
}

export function memberDisplayName(p: MemberProfile, fallback = "Staff"): string {
  return (
    p.full_name?.trim() ||
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    p.email ||
    fallback
  );
}
