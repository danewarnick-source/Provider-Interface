// The checks every path that puts a staff member on a client's shift must run:
// the client is authorized for the code, the staff member is assigned that code
// for the client, and the staff member is not on approved time off.
// Used by saveShift, applyDrafts, decideClaim and publishWeek.
import { assignmentCoversCode, normalizeServiceCode } from "../assignment-codes.ts";
import { dayKey } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ShiftToCheck = {
  organization_id: string;
  staff_id: string | null;
  client_id: string | null;
  code: string | null;
  starts_at: string;
};

export async function assertClientAuthorizedForCode(
  supabase: Db,
  orgId: string,
  clientId: string,
  code: string,
) {
  const today = dayKey(new Date());
  const { data, error } = await supabase
    .from("client_billing_codes")
    .select("id, service_end_date")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("service_code", code);
  if (error) throw error;
  const open = (data ?? []).some(
    (r: { service_end_date: string | null }) => !r.service_end_date || r.service_end_date > today,
  );
  if (!open) {
    throw new Error(`Client isn't authorized for ${code}. Add the code on the client profile first.`);
  }
}

export async function assertStaffOnCaseload(
  supabase: Db,
  orgId: string,
  staffId: string,
  clientId: string,
  code: string,
  staffName: string,
  clientName: string,
) {
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, service_codes")
    .eq("organization_id", orgId)
    .eq("staff_id", staffId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`You can't schedule this — ${staffName} isn't authorized to work with ${clientName}.`);
  }
  // The assignment lists its codes explicitly; NULL / [] covers nothing.
  if (!assignmentCoversCode((data as { service_codes: string[] | null }).service_codes, code)) {
    throw new Error(
      `You can't schedule this — ${staffName} isn't assigned ${normalizeServiceCode(code)} for ${clientName}.`,
    );
  }
}

export async function assertStaffNotOnTimeOff(
  supabase: Db,
  orgId: string,
  staffId: string,
  startsAt: string,
  staffName: string,
) {
  const day = dayKey(startsAt);
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("id")
    .eq("organization_id", orgId)
    .eq("staff_id", staffId)
    .eq("status", "approved")
    .lte("start_date", day)
    .gte("end_date", day)
    .limit(1);
  if (error) throw error;
  if ((data ?? []).length > 0) throw new Error(`${staffName} is off that day.`);
}

/** Display names for friendlier errors. Two plain queries, no embeds. */
export async function loadShiftNames(supabase: Db, staffId: string | null, clientId: string | null) {
  const [client, staff] = await Promise.all([
    clientId
      ? supabase.from("clients").select("first_name, last_name").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    staffId
      ? supabase.from("profiles").select("first_name, last_name, full_name").eq("id", staffId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const s = staff.data;
  const c = client.data;
  return {
    staffName:
      (s?.full_name && String(s.full_name).trim()) ||
      [s?.first_name, s?.last_name].filter(Boolean).join(" ").trim() ||
      "That staff member",
    clientName: [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || "this client",
  };
}

/** Throws the first failed check for one shift. Open shifts (no staff) only check authorization. */
export async function assertShiftAllowed(supabase: Db, shift: ShiftToCheck) {
  if (!shift.client_id || !shift.code) return;
  await assertClientAuthorizedForCode(supabase, shift.organization_id, shift.client_id, shift.code);
  if (!shift.staff_id) return;
  const { staffName, clientName } = await loadShiftNames(supabase, shift.staff_id, shift.client_id);
  await assertStaffOnCaseload(
    supabase, shift.organization_id, shift.staff_id, shift.client_id, shift.code, staffName, clientName,
  );
  await assertStaffNotOnTimeOff(supabase, shift.organization_id, shift.staff_id, shift.starts_at, staffName);
}

export type ShiftFailure = { shift_id: string; reason: string };

/** Runs the checks on many shifts; returns every failure instead of throwing. */
export async function collectShiftFailures(
  supabase: Db,
  shifts: Array<ShiftToCheck & { id: string }>,
): Promise<ShiftFailure[]> {
  const failures: ShiftFailure[] = [];
  const memo = new Map<string, Promise<string | null>>();
  for (const s of shifts) {
    const key = [s.client_id, s.staff_id, s.code, s.staff_id ? dayKey(s.starts_at) : ""].join("|");
    let result = memo.get(key);
    if (!result) {
      result = assertShiftAllowed(supabase, s).then(
        () => null,
        (e: unknown) => (e instanceof Error ? e.message : "Shift failed a check"),
      );
      memo.set(key, result);
    }
    const reason = await result;
    if (reason) failures.push({ shift_id: s.id, reason });
  }
  return failures;
}
