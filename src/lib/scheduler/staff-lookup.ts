// Active staff with display names, for Nectar drafting and imports.
// organization_members and profiles have no FK between them (both key off
// auth.users.id), so this is two queries joined in JS — never a PostgREST embed.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type StaffName = { id: string; name: string };

export async function loadActiveStaffNames(supabase: Db, organizationId: string): Promise<StaffName[]> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) throw error;
  const ids = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name")
    .in("id", ids);
  if (pErr) throw pErr;
  return ((profiles ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  }>).map((p) => ({
    id: p.id,
    name:
      p.full_name?.trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      "Staff",
  }));
}
