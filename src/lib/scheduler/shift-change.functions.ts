// The staff phone's "your shift changed" cards (B4, My Schedule). listMyShiftChanges:
// the sent changes that affect the signed-in person and that they haven't
// tapped Got it on, one card per shift (collapseChanges + changeCard in
// shift-change.ts), with the home's name when the shift is at a home.
// ackShiftChange records Got it (shift_change_acks). Both run as the caller:
// RLS lets a person read only changes naming them, and acknowledge only a
// sent change that names them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  changeCard,
  collapseChanges,
  type ChangeCard,
  type ChangeRow,
} from "@/lib/scheduler/shift-change";

const uuid = z.string().uuid();

export type MyChange = ChangeCard & { shiftId: string; changeIds: string[] };

export const listMyShiftChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => z.object({ organization_id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<MyChange[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    const { data: rows, error } = await supabase
      .from("shift_changes")
      .select("id, shift_id, affected_staff_ids, before, after, changed_at")
      .eq("organization_id", data.organization_id)
      .contains("affected_staff_ids", [userId])
      .not("sent_at", "is", null)
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const changes = (rows ?? []) as unknown as ChangeRow[];
    if (!changes.length) return [];
    const { data: acks, error: aErr } = await supabase
      .from("shift_change_acks")
      .select("change_id")
      .eq("staff_id", userId)
      .in(
        "change_id",
        changes.map((c) => c.id),
      );
    if (aErr) throw aErr;
    const seen = new Set((acks ?? []).map((a) => a.change_id));
    const net = collapseChanges(changes.filter((c) => !seen.has(c.id))).filter((n) =>
      n.affected.includes(userId),
    );
    const teamIds = [
      ...new Set(
        net.map((n) => n.after.team_id ?? n.before.team_id).filter((x): x is string => !!x),
      ),
    ];
    const { data: teams } = teamIds.length
      ? await supabase.from("teams").select("id, team_name").in("id", teamIds)
      : { data: [] as { id: string; team_name: string }[] };
    const names = new Map((teams ?? []).map((t) => [t.id, t.team_name]));
    return net
      .sort((a, b) => a.after.starts_at.localeCompare(b.after.starts_at))
      .map((n) => ({
        shiftId: n.shiftId,
        changeIds: n.changeIds,
        ...changeCard(n, userId, names.get(n.after.team_id ?? n.before.team_id ?? "") ?? ""),
      }));
  });

export const ackShiftChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; change_ids: string[] }) =>
    z.object({ organization_id: uuid, change_ids: z.array(uuid).min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to mark this as seen.");
    const { error } = await supabase.from("shift_change_acks").upsert(
      data.change_ids.map((change_id) => ({
        change_id,
        staff_id: userId,
        organization_id: data.organization_id,
      })),
      { onConflict: "change_id,staff_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`That wasn't saved (${error.message}). Try Got it again.`);
    return { ok: true };
  });
