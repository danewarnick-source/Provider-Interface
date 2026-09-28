/**
 * Executive screens may read client and timesheet totals only.
 * The caller must already have confirmed is_hive_executive. These helpers
 * return counts and sums, never the underlying rows.
 */

export function execAggregateAllowed(isHiveExecutive: boolean | null | undefined, rpcFailed: boolean): boolean {
  return !rpcFailed && isHiveExecutive === true;
}

export function sumClockedHours(
  rows: ReadonlyArray<{ clock_in_timestamp: string; clock_out_timestamp: string | null }>,
): number {
  let hours = 0;
  for (const row of rows) {
    if (!row.clock_out_timestamp) continue;
    const h =
      (new Date(row.clock_out_timestamp).getTime() - new Date(row.clock_in_timestamp).getTime()) /
      3_600_000;
    if (h > 0 && Number.isFinite(h)) hours += h;
  }
  return Math.round(hours * 10) / 10;
}

export function distinctActiveStaff(rows: ReadonlyArray<{ staff_id: string | null }>): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.staff_id) ids.add(row.staff_id);
  }
  return ids.size;
}

export function usageCounts(input: {
  staffCount: number;
  clientCount: number;
  hoursLast30d: number;
  activeStaffLast7d: number;
}): {
  staff_count: number;
  client_count: number;
  hours_last_30d: number;
  active_staff_last_7d: number;
} {
  return {
    staff_count: input.staffCount,
    client_count: input.clientCount,
    hours_last_30d: input.hoursLast30d,
    active_staff_last_7d: input.activeStaffLast7d,
  };
}
