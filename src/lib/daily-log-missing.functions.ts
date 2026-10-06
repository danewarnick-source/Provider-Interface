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
  isHostHomeProviderPosition,
  missingDailyNotes,
  type DailyNoteAssignment,
  type DailyNoteRow,
} from "@/lib/daily-log-missing";
import { selectIn } from "@/lib/team-members/roster.functions";
import { loadActiveCodes } from "@/lib/clients/codes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export type DailyNoteFacts = {
  assignments: DailyNoteAssignment[];
  notes: DailyNoteRow[];
};

/** Every assignment (with its host flag) and every non-rejected note on these clients since `since`. */
export async function loadDailyNoteFacts(
  admin: Sb,
  orgId: string,
  clientIds: readonly string[],
  since: string,
): Promise<DailyNoteFacts> {
  const ids = [...new Set(clientIds)];
  if (!ids.length) return { assignments: [], notes: [] };
  const [assigns, notes, staffTypes] = await Promise.all([
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
    admin.from("staff_types").select("key, label").eq("organization_id", orgId),
  ]);
  if (staffTypes.error) throw new Error(staffTypes.error.message);
  const labelByKey = new Map(
    ((staffTypes.data ?? []) as Array<{ key: string; label: string | null }>).map((t) => [
      t.key,
      t.label ?? t.key,
    ]),
  );
  const staffIds = [...new Set(assigns.map((a) => a.staff_id))];
  const profiles = await selectIn<{ id: string; staff_type_keys: string[] | null }>(
    (chunk) => admin.from("profiles").select("id, staff_type_keys").in("id", chunk),
    staffIds,
  );
  const hosts = new Set(
    profiles
      .filter((p) =>
        (p.staff_type_keys ?? []).some((key) =>
          isHostHomeProviderPosition({ key, label: labelByKey.get(key) ?? key }),
        ),
      )
      .map((p) => p.id),
  );
  return {
    assignments: assigns.map((a) => ({
      clientId: a.client_id,
      staffId: a.staff_id,
      startDate: denverYmdFromInstant(a.created_at) ?? a.created_at.slice(0, 10),
      isHost: hosts.has(a.staff_id),
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
    });
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
