// A client's away times (client_away_times, B7): add one and remove one
// (archived, never deleted). Called from the client's profile (Profile ›
// Away times) and the home page's Residents card. Needs Clients edit; writes
// run as the caller (RLS: Clients edit on a client they can see, same agency).
// Read in the browser (components/clients/shared/use-away-times.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { assertRowsChanged } from "./writes";
import { AWAY_LABELS, awayMask, awayProblem, type AwayDraft } from "./away-times";

type Sb = SupabaseClient<Database>;
const uuid = z.string().uuid();
const scope = { organizationId: uuid, clientId: uuid };

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

export const addAwayTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...scope,
        draft: z.object({
          days: z.array(z.number().int().min(0).max(6)).max(7),
          start: z.string(),
          end: z.string(),
          label: z.enum(AWAY_LABELS.map(([k]) => k) as [string, ...string[]]),
          note: z.string(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireCategory(sb, userId, data.organizationId, "clients", "edit");
    const draft = data.draft as AwayDraft;
    const problem = awayProblem(draft);
    if (problem) throw new Error(problem);
    const { data: row, error } = await sb
      .from("client_away_times")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        weekday_mask: awayMask(draft),
        start_time: draft.start,
        end_time: draft.end,
        label: draft.label,
        note: draft.note.trim() || null,
        created_by: userId,
      })
      .select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(row)[0]!.id };
  });

export const archiveAwayTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireCategory(sb, userId, data.organizationId, "clients", "edit");
    const now = new Date().toISOString();
    const { data: row, error } = await sb
      .from("client_away_times")
      .update({ archived_at: now, updated_at: now })
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .eq("id", data.id)
      .is("archived_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(row)[0]!.id };
  });
