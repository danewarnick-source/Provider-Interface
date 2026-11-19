/**
 * Schedule requests from the phone: a team member's own time-off and swap
 * requests (useMyScheduleRequests) and creating them. Reads and writes are
 * scoped to the caller's organization and enforced by RLS. Deciding them is on
 * the server (requests.functions.ts), from Scheduler › Needs you.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { notify } from "@/lib/scheduler/notify";

export type TimeOffRequest = {
  id: string;
  organization_id: string;
  staff_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  type: "pto" | "sick" | "personal" | "unpaid" | "other";
  note: string | null;
  status: "pending" | "approved" | "denied" | "cancelled";
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type SwapRequest = {
  id: string;
  organization_id: string;
  shift_id: string;
  from_staff_id: string;
  to_staff_id: string | null;
  note: string | null;
  status: "pending" | "approved" | "denied" | "cancelled";
  partner_status: "pending" | "accepted" | "declined";
  partner_responded_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

// ─── Staff: only my requests ───────────────────────────────────────────────
export function useMyScheduleRequests() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  return useQuery({
    enabled: !!orgId && !!user?.id,
    queryKey: ["my-schedule-requests", orgId, user?.id],
    queryFn: async () => {
      const [toRes, swRes] = await Promise.all([
        supabase
          .from("time_off_requests" as never)
          .select("*")
          .eq("organization_id", orgId!)
          .eq("staff_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("shift_swap_requests" as never)
          .select("*")
          .eq("organization_id", orgId!)
          .eq("from_staff_id", user!.id)
          .order("created_at", { ascending: false }),
      ]);
      if (toRes.error) throw toRes.error;
      if (swRes.error) throw swRes.error;
      return {
        timeOff: (toRes.data ?? []) as unknown as TimeOffRequest[],
        swaps: (swRes.data ?? []) as unknown as SwapRequest[],
      };
    },
  });
}

// ─── Create ────────────────────────────────────────────────────────────────
export async function createTimeOffRequest(input: {
  organization_id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  type: TimeOffRequest["type"];
  note?: string | null;
}) {
  if (!input.start_date || !input.end_date) throw new Error("Pick a date range.");
  if (input.end_date < input.start_date) throw new Error("End date must be on or after start.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("time_off_requests").insert({
    organization_id: input.organization_id,
    staff_id: input.staff_id,
    start_date: input.start_date,
    end_date: input.end_date,
    type: input.type,
    note: input.note?.trim() || null,
    status: "pending",
  });
  if (error) throw error;

  // A failed notification is logged and never blocks the request itself.
  await notify(supabase, {
    organization_id: input.organization_id,
    recipient_role: "admin",
    type: "time_off_requested",
    urgency: "normal",
    title: "New time-off request",
    body: `${fmtRange(input.start_date, input.end_date)} · ${input.type.toUpperCase()}${input.note ? ` — ${input.note.trim()}` : ""}`,
    link_to: "/dashboard/scheduler/needs",
    related_type: "time_off_request",
  });
}

function fmtRange(s: string, e: string) {
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return s === e ? f(s) : `${f(s)} – ${f(e)}`;
}

export async function createSwapRequest(input: {
  organization_id: string;
  shift_id: string;
  from_staff_id: string;
  to_staff_id: string | null;
  note?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("shift_swap_requests")
    .insert({
      organization_id: input.organization_id,
      shift_id: input.shift_id,
      from_staff_id: input.from_staff_id,
      to_staff_id: input.to_staff_id ?? null,
      note: input.note?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  const base = {
    organization_id: input.organization_id,
    type: "swap_request",
    related_id: row?.id as string | undefined,
    related_type: "shift_swap_request",
  };
  await notify(supabase, [
    {
      ...base,
      recipient_role: "admin",
      title: "Swap requested",
      body: "A team member asked to swap a shift. Review it in the scheduler.",
      link_to: "/dashboard/scheduler/needs",
    },
    ...(input.to_staff_id
      ? [
          {
            ...base,
            recipient_role: "staff" as const,
            recipient_user_id: input.to_staff_id,
            title: "A coworker asked you to take a shift",
            body: "Open your schedule to accept or decline the swap.",
            link_to: "/dashboard/schedule",
          },
        ]
      : []),
  ]);
}
