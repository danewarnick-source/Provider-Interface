// Publish a week of the scheduler (/dashboard/scheduler). All or nothing:
// every unpublished staffed shift in the week runs the rule engine
// (shift-guard.server.ts) and nothing is published while one is refused; the
// screen lists each refused shift with its one-line reason. Notifies each
// team member once.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { denverWeekUtcBounds } from "@/lib/scheduler/recurrence";
import { requireCategory } from "@/lib/access/require";
import {
  checkShiftRows,
  refusalsByShift,
  type ShiftRowIn,
} from "@/lib/scheduler/shift-guard.server";
import { warningLines } from "@/lib/scheduler/rules";
import { dayKey } from "@/lib/scheduler/time";
import { notify } from "@/lib/scheduler/notify";

export const publishWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; week_start_iso: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        week_start_iso: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId)
      return { ok: true as const, shifts: 0, staff: 0, failures: [], warnings: [] as string[] };
    await requireCategory(supabase, userId, data.organization_id, "scheduling", "edit");
    const { startIso, endExclusiveIso } = denverWeekUtcBounds(data.week_start_iso);

    const { data: pending, error: pErr } = await supabase
      .from("scheduled_shifts")
      .select(
        "id, staff_id, client_id, team_id, service_code, starts_at, ends_at, parent_shift_id, status, van_route_id",
      )
      .eq("organization_id", data.organization_id)
      .eq("published", false)
      .neq("status", "cancelled")
      .gte("starts_at", startIso)
      .lt("starts_at", endExclusiveIso)
      .not("staff_id", "is", null);
    if (pErr) throw pErr;
    const toPublish = (pending ?? []) as ShiftRowIn[];

    // Publish nothing unless every shift passes the rule engine (as saveShift).
    const { verdict } = await checkShiftRows(supabase, data.organization_id, toPublish);
    const refused = refusalsByShift(verdict);
    if (refused.size > 0) {
      const byId = new Map(toPublish.map((r) => [r.id, r] as const));
      return {
        ok: false as const,
        shifts: 0,
        staff: 0,
        failures: [...refused].map(([shiftId, reason]) => ({
          shift_id: shiftId,
          day: dayKey(byId.get(shiftId)!.starts_at),
          code: byId.get(shiftId)!.service_code,
          reason,
        })),
        warnings: [] as string[],
      };
    }

    const { data: rows, error } = await supabase
      .from("scheduled_shifts")
      .update({ published: true, status: "published" })
      .in(
        "id",
        toPublish.map((r) => r.id!),
      )
      .select("id, staff_id");
    if (error) throw error;
    const byStaff = new Map<string, number>();
    for (const r of rows ?? []) {
      const sid = (r as { staff_id: string | null }).staff_id;
      if (!sid) continue;
      byStaff.set(sid, (byStaff.get(sid) ?? 0) + 1);
    }
    if (byStaff.size > 0) {
      const weekLabel = new Date(startIso).toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        month: "short",
        day: "numeric",
      });
      const notifs = Array.from(byStaff.entries()).map(([staffId, count]) => ({
        organization_id: data.organization_id,
        recipient_role: "staff",
        recipient_user_id: staffId,
        type: "shift_published",
        urgency: "normal",
        title: "Your schedule was published",
        body: `You have ${count} new or updated shift${count === 1 ? "" : "s"} for the week of ${weekLabel}.`,
        link_to: "/dashboard/schedule",
      }));
      await notify(supabase, notifs);
    }
    return {
      ok: true as const,
      shifts: rows?.length ?? 0,
      staff: byStaff.size,
      failures: [],
      warnings: warningLines(verdict),
    };
  });
