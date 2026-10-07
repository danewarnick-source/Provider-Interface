// Shared read model for "which staff are assigned to work which authorized
// code for this client". Single source of truth for both the persistent
// Authorized Codes section on the client profile and the intake add-codes
// prompt — both read/write the same staff_assignments rows via
// setStaffClientCodes (setup.functions.ts). Every row lists its codes;
// NULL / [] covers no code (never "all codes").
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import {
  assignmentCodes,
  assignmentCoversCode,
  uncoveredCodes,
} from "@/lib/assignment-codes";
import { loadActiveCodes } from "@/lib/clients/codes";

export type StaffOption = { id: string; name: string };

export function clientCodeAssignmentsQueryKey(clientId: string) {
  return ["client-code-assignments", clientId] as const;
}

export function useClientCodeAssignments(clientId: string | undefined) {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;

  const q = useQuery({
    enabled: !!orgId && !!clientId,
    queryKey: clientCodeAssignmentsQueryKey(clientId ?? ""),
    queryFn: async (): Promise<{
      assignments: Array<{ staff_id: string; service_codes: string[] | null }>;
      staffPool: StaffOption[];
      authorizedCodes: string[];
    }> => {
      const [assignRes, clientRes, membersRes] = await Promise.all([
        supabase
          .from("staff_assignments")
          .select("staff_id, service_codes")
          .eq("organization_id", orgId!)
          .eq("client_id", clientId!),
        loadActiveCodes(supabase, [clientId!]),
        supabase
          .from("organization_members")
          .select("user_id")
          .is("deleted_at", null)
          .eq("organization_id", orgId!)
          .eq("active", true),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (membersRes.error) throw membersRes.error;

      const authorizedCodes = clientRes.get(clientId!) ?? [];

      const memberIds = ((membersRes.data ?? []) as Array<{ user_id: string | null }>)
        .map((m) => m.user_id)
        .filter((x): x is string => !!x);

      let staffPool: StaffOption[] = [];
      if (memberIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, full_name, is_active")
          .in("id", memberIds);
        if (pErr) throw pErr;
        staffPool = ((profs ?? []) as Array<{
          id: string; first_name: string | null; last_name: string | null;
          full_name: string | null; is_active: boolean | null;
        }>)
          .filter((p) => p.is_active !== false)
          .map((p) => ({
            id: p.id,
            name:
              (p.full_name?.trim()) ||
              [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
              "Staff",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      return {
        assignments: (assignRes.data ?? []) as Array<{ staff_id: string; service_codes: string[] | null }>,
        staffPool,
        authorizedCodes,
      };
    },
  });

  const staffById = useMemo(() => {
    const m = new Map<string, StaffOption>();
    for (const s of q.data?.staffPool ?? []) m.set(s.id, s);
    return m;
  }, [q.data?.staffPool]);

  /** Staff currently assigned to work the given code (explicit codes only). */
  function staffForCode(code: string): StaffOption[] {
    const out: StaffOption[] = [];
    for (const a of q.data?.assignments ?? []) {
      if (!assignmentCoversCode(a.service_codes, code)) continue;
      const s = staffById.get(a.staff_id);
      out.push(s ?? { id: a.staff_id, name: "Staff" });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Org staff not yet covering the given code — candidates for "+ Add staff". */
  function unassignedForCode(code: string): StaffOption[] {
    const assignedIds = new Set(staffForCode(code).map((s) => s.id));
    return (q.data?.staffPool ?? []).filter((s) => !assignedIds.has(s.id));
  }

  /** The explicit codes a staff member currently has on this client ([] when unassigned). */
  function codesForStaff(staffId: string): string[] {
    const row = (q.data?.assignments ?? []).find((a) => a.staff_id === staffId);
    return assignmentCodes(row?.service_codes);
  }

  /** Authorized codes nobody is assigned to yet. [] while loading. */
  const codesWithoutStaff = q.data
    ? uncoveredCodes(q.data.authorizedCodes, q.data.assignments)
    : [];

  return {
    ...q,
    orgId,
    authorizedCodes: q.data?.authorizedCodes ?? [],
    staffForCode,
    unassignedForCode,
    codesForStaff,
    codesWithoutStaff,
  };
}
