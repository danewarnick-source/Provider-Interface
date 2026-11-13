// Loads the facts for the shared host-home note rule (./daily-log-missing.ts).
// Service-role reads, because daily_logs RLS only shows staff their own rows
// and "met by any assigned staff" needs a co-worker's note too. Returns only
// yes/no gaps — never another person's note text.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { denverYmdFromInstant } from "@/lib/denver-date";
import {
  dailyLogProgram,
  dailyNoteGapsFor,
  missingDailyNotes,
  type DailyNoteAssignment,
  type DailyNoteRow,
} from "@/lib/daily-log-missing";
import { selectIn } from "@/lib/team-members/roster.functions";
import { loadActiveCodes } from "@/lib/clients/services/codes";
import { hostOfClient, type HomeForHost } from "@/lib/homes/home-kind";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export type DailyNoteFacts = {
  assignments: DailyNoteAssignment[];
  notes: DailyNoteRow[];
};

/**
 * Every assignment (flagged when that staff member is the client's host, i.e. the
 * lead of the client's host home) and every non-rejected note on these clients
 * since `since`.
 */
export async function loadDailyNoteFacts(
  admin: Sb,
  orgId: string,
  clientIds: readonly string[],
  since: string,
): Promise<DailyNoteFacts> {
  const ids = [...new Set(clientIds)];
  if (!ids.length) return { assignments: [], notes: [] };
  const [assigns, notes, clientHomes] = await Promise.all([
    selectIn<{ staff_id: string; client_id: string; created_at: string }>(
      (chunk) =>
        admin
          .from("staff_assignments")
          .select("staff_id, client_id, created_at")
          .eq("organization_id", orgId)
          .in("client_id", chunk),
      ids,
    ),
    selectIn<DailyNoteRow>(
      (chunk) =>
        admin
          .from("daily_logs")
          .select("client_id, log_date, user_id")
          .eq("organization_id", orgId)
          .in("client_id", chunk)
          .gte("log_date", since)
          .neq("status", "rejected"),
      ids,
    ),
    selectIn<{ id: string; team_id: string | null }>(
      (chunk) =>
        admin.from("clients").select("id, team_id").eq("organization_id", orgId).in("id", chunk),
      ids,
    ),
  ]);
  const homeIds = [...new Set(clientHomes.map((c) => c.team_id).filter((x): x is string => !!x))];
  const homes = await selectIn<HomeForHost>(
    (chunk) =>
      admin
        .from("teams")
        .select("id, team_type, manager_id")
        .eq("organization_id", orgId)
        .in("id", chunk),
    homeIds,
  );
  const homesById = new Map(homes.map((h) => [h.id, h]));
  const hostByClient = new Map(clientHomes.map((c) => [c.id, hostOfClient(c, homesById)]));
  return {
    assignments: assigns.map((a) => ({
      clientId: a.client_id,
      staffId: a.staff_id,
      startDate: denverYmdFromInstant(a.created_at) ?? a.created_at.slice(0, 10),
      isHost: hostByClient.get(a.client_id) === a.staff_id,
    })),
    notes,
  };
}

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Daily Logs page: the signed-in person's missing host-home notes — days on
 * their caseload's HHS / RP5 clients where they're the host and no assigned
 * staff wrote the note.
 */
export const listMyMissingDailyNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), dates: z.array(YMD).min(1).max(62) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Array<{ clientId: string; date: string }>> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    // clients_for_staff checks the caller is an org member asking about themself.
    const { data: caseload, error } = await (supabase as Sb).rpc("clients_for_staff", {
      _org: data.organizationId,
      _staff: userId,
    }).is("deleted_at", null);
    if (error) throw new Error(error.message);
    const rows = (caseload ?? []) as Array<{ id: string }>;
    const codes = await loadActiveCodes(supabase as Sb, rows.map((c) => c.id));
    const clients = rows
      .map((c) => ({ id: c.id, codes: codes.get(c.id) ?? [] }))
      .filter((c) => dailyLogProgram(c) !== null);
    if (!clients.length) return [];
    const since = [...data.dates].sort()[0]!;
    const facts = await loadDailyNoteFacts(
      supabaseAdmin as Sb,
      data.organizationId,
      clients.map((c) => c.id),
      since,
    );
    const gaps = missingDailyNotes({ clients, ...facts, dates: data.dates });
    return dailyNoteGapsFor(gaps, userId).map((g) => ({ clientId: g.client.id, date: g.date }));
  });
