// The board's queries: its data (lib/scheduler/board-data.ts), the rule
// findings for the week's staffed shifts (weekChecks), and the 1056 outlook
// for the Clients view, and the unsent changes to published shifts (B4; RLS
// lets schedulers read shift_changes). Findings load separately so a slow
// engine never holds up the grid.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { weekChecks, type Check } from "@/lib/scheduler/find-staff.functions";
import { loadBoardData, type BoardRange } from "@/lib/scheduler/board-data";
import { loadAuthOutlook } from "@/lib/scheduler/auth-outlook-load";
import { supabase } from "@/integrations/supabase/client";
import { collapseChanges, type ChangeRow, type NetChange } from "@/lib/scheduler/shift-change";

export function useBoardData(orgId: string | undefined, range: BoardRange) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["scheduler-board", orgId, range.startIso, range.endIso],
    queryFn: () => loadBoardData(orgId!, range),
  });
}

/** Rule findings for the staffed shifts in range, by shift id (chip flags and the drawer's checks). */
export function useWeekChecks(
  orgId: string | undefined,
  range: { startIso: string; endIso: string },
) {
  const run = useServerFn(weekChecks);
  return useQuery({
    enabled: !!orgId,
    queryKey: ["scheduler-board", "checks", orgId, range.startIso, range.endIso],
    queryFn: (): Promise<Record<string, Check[]>> =>
      run({ data: { organization_id: orgId!, start_iso: range.startIso, end_iso: range.endIso } }),
  });
}

export function useAuthOutlook(orgId: string | undefined, weekStart: string, enabled: boolean) {
  return useQuery({
    enabled: !!orgId && enabled,
    queryKey: ["scheduler-board", "outlook", orgId, weekStart],
    queryFn: () => loadAuthOutlook(supabase, orgId!, weekStart),
  });
}

/** Every unsent change in the agency, collapsed per shift; ones that cancel out are dropped. */
export function useUnsentChanges(orgId: string | undefined) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["scheduler-board", "changes", orgId],
    queryFn: async (): Promise<NetChange[]> => {
      const { data, error } = await supabase
        .from("shift_changes")
        .select("id, shift_id, affected_staff_ids, before, after, changed_at")
        .eq("organization_id", orgId!)
        .is("sent_at", null);
      if (error) throw new Error(error.message);
      return collapseChanges((data ?? []) as unknown as ChangeRow[]).filter((c) => c.real);
    },
  });
}
