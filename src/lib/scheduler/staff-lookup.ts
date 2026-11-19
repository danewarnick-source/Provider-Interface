// Team members' display names. organization_members and profiles have no FK
// between them (both key off auth.users.id), so this is two queries joined in
// JS — never a PostgREST embed. Callers: the hold-over record
// (holdover.functions.ts) and the escalation ladder's names
// (escalation*.functions.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type StaffName = { id: string; name: string };

/** Names for these people (profiles), "Staff" when a profile has none. */
export async function loadStaffNames(supabase: Db, ids: readonly string[]): Promise<StaffName[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name")
    .in("id", unique);
  if (pErr) throw new Error(pErr.message);
  return (
    (profiles ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    }>
  ).map((p) => ({
    id: p.id,
    name:
      p.full_name?.trim() ||
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
      "Staff",
  }));
}

/** The same, as a map. */
export async function staffNameMap(
  supabase: Db,
  ids: readonly string[],
): Promise<Map<string, string>> {
  return new Map((await loadStaffNames(supabase, ids)).map((p) => [p.id, p.name]));
}

export async function loadActiveStaffNames(
  supabase: Db,
  organizationId: string,
): Promise<StaffName[]> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .is("deleted_at", null)
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) throw new Error(error.message);
  return loadStaffNames(
    supabase,
    ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
  );
}
