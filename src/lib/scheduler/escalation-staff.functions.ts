// The staff side of the escalation ladder, on My Schedule: the "Can you
// cover?" / "Can you stay?" cards (listMyEscalationAsks) and their answers
// (answerEscalation → escalation-answer.server.ts). A card shows while the
// person's ask is unanswered, the ladder is still running and the shift still
// has no one. Any active member may call these; each acts only on the
// caller's own asks. Texts name the code, day, time and home, never a client.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { needsPerson, type Rung } from "@/lib/scheduler/escalation";
import { askCard } from "@/lib/scheduler/escalation-view";
import { answerAsk, openAsk } from "@/lib/scheduler/escalation-answer.server";
import {
  ESC_SHIFT_COLUMNS,
  loadLadderEvents,
  type EscShift,
} from "@/lib/scheduler/escalation-load.server";
import { rows } from "@/lib/scheduler/rule-staff-facts.server";

const uuid = z.string().uuid();

export type MyAsk = { shiftId: string; rung: Rung; title: string; detail: string; yes: string };

/** How far back an ask can still be on a card. */
const ASK_LOOKBACK_HOURS = 48;

export const listMyEscalationAsks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => z.object({ organization_id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<MyAsk[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireOrgMembership(supabase, userId, data.organization_id);
    const since = new Date(Date.now() - ASK_LOOKBACK_HOURS * 3_600_000).toISOString();
    const mine = await rows<{ scheduled_shift_id: string | null }>(
      supabase
        .from("callout_escalation_events")
        .select("scheduled_shift_id")
        .eq("organization_id", data.organization_id)
        .eq("target_user_id", userId)
        .eq("channel", "push")
        .not("scheduled_shift_id", "is", null)
        .gte("created_at", since),
    );
    const ids = [...new Set(mine.map((r) => r.scheduled_shift_id!))];
    if (!ids.length) return [];
    // The shift, its whole ladder and its home's name: the caller was asked
    // about these shifts, so they're read with the service role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [shifts, events] = await Promise.all([
      rows<EscShift>(
        supabaseAdmin.from("scheduled_shifts").select(ESC_SHIFT_COLUMNS).in("id", ids),
      ),
      loadLadderEvents(supabaseAdmin, ids),
    ]);
    const now = Date.now();
    const asks = shifts
      .filter((s) => needsPerson(s) && new Date(s.ends_at).getTime() > now)
      .map((s) => ({ s, ask: openAsk(events.get(s.id) ?? [], userId) }))
      .filter((x) => !!x.ask);
    if (!asks.length) return [];
    const clientIds = asks.map((x) => x.s.client_id).filter((x): x is string => !!x);
    const clients = clientIds.length
      ? await rows<{ id: string; team_id: string | null }>(
          supabaseAdmin.from("clients").select("id, team_id").in("id", clientIds),
        )
      : [];
    const homeOf = (s: EscShift) =>
      s.team_id ?? clients.find((c) => c.id === s.client_id)?.team_id ?? null;
    const homeIds = [...new Set(asks.map((x) => homeOf(x.s)).filter((x): x is string => !!x))];
    const teams = homeIds.length
      ? await rows<{ id: string; team_name: string }>(
          supabaseAdmin.from("teams").select("id, team_name").in("id", homeIds),
        )
      : [];
    return asks
      .sort((a, b) => a.s.starts_at.localeCompare(b.s.starts_at))
      .map(({ s, ask }) => ({
        shiftId: s.id,
        rung: ask!.rung,
        ...askCard(s, ask!.rung, teams.find((t) => t.id === homeOf(s))?.team_name ?? ""),
      }));
  });

export const answerEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; shift_id: string; answer: "yes" | "no" }) =>
    z.object({ organization_id: uuid, shift_id: uuid, answer: z.enum(["yes", "no"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to answer.");
    await requireOrgMembership(supabase, userId, data.organization_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return answerAsk(supabaseAdmin, data.organization_id, data.shift_id, userId, data.answer);
  });
