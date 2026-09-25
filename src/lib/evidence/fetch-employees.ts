import { supabase } from "@/integrations/supabase/client";
import { mapEmployeeRowsToPeople, type EvidenceEmployeeRow } from "./people.ts";
import type { EvidencePerson } from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Same browser + RLS path as the Employees page: members, then profiles,
 * then the active-roster filter (not a separate “staff” query).
 */
export async function fetchEvidenceEmployees(
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  const members = await sb
    .from("organization_members")
    .select("user_id, role:access_level, job_title, active")
    .eq("organization_id", organizationId);
  if (members.error) {
    return { people: [], error: members.error.message };
  }
  const rows = (members.data ?? []) as Array<{
    user_id: string;
    role: string | null;
    job_title: string | null;
    active: boolean | null;
  }>;
  const ids = rows.map((m) => m.user_id).filter((id) => typeof id === "string");
  if (ids.length === 0) {
    return { people: [], error: null };
  }

  const withHire = await sb
    .from("profiles")
    .select(
      "id, full_name, first_name, last_name, account_status, is_active, hire_date, start_date",
    )
    .in("id", ids);
  const full = withHire.error
    ? await sb
        .from("profiles")
        .select("id, full_name, first_name, last_name, account_status, is_active")
        .in("id", ids)
    : withHire;
  const slim = full.error
    ? await sb.from("profiles").select("id, full_name, account_status, is_active").in("id", ids)
    : full;
  if (slim.error) {
    return {
      people: [],
      error: slim.error.message || full.error?.message || "Could not load employees.",
    };
  }

  const profMap = new Map(
    (
      (slim.data ?? []) as Array<{
        id: string;
        full_name: string | null;
        first_name?: string | null;
        last_name?: string | null;
        account_status: string | null;
        is_active: boolean | null;
        hire_date?: string | null;
        start_date?: string | null;
      }>
    ).map((p) => [p.id, p]),
  );
  const joined: EvidenceEmployeeRow[] = rows.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    job_title: m.job_title,
    active: m.active !== false,
    profile: profMap.get(m.user_id) ?? null,
  }));
  return { people: mapEmployeeRowsToPeople(joined), error: null };
}
