// Team section writes that aren't code assignments: the do-not-schedule list
// (client_staff_exclusions) and office notes (client_notes). Each runs
// assertCanManageClient first and writes with the caller's RLS client.
// Exclusions are ended and notes archived — never deleted. Staff-to-code
// assignments stay on setStaffClientCodes (lib/scheduler/setup.functions).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { cleanExclusionReason } from "./exclusions";
import { cleanNoteBody } from "./notes";
import { assertRowsChanged } from "./writes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const scope = z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() });

async function guard(
  context: { supabase?: unknown; userId?: string | null },
  s: z.infer<typeof scope>,
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  await assertCanManageClient({
    supabase: sb,
    actorId: context.userId,
    organizationId: s.organizationId,
    clientId: s.clientId,
    action: "edit",
  });
  return { sb, userId: context.userId };
}

function ok<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

/** Put a team member on the client's do-not-schedule list. */
export const addStaffExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ staffId: z.string().uuid(), reason: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const reason = ok(cleanExclusionReason(data.reason));
    const { data: assigned, error: aErr } = await sb
      .from("staff_assignments")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .eq("staff_id", data.staffId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (assigned) throw new Error("Take this team member off the client's codes first.");
    const { data: rows, error } = await sb
      .from("client_staff_exclusions")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        staff_user_id: data.staffId,
        reason,
        created_by: userId,
      })
      .select("id");
    if (error) {
      if (error.code === "23505") throw new Error("This team member is already on the list.");
      throw new Error(error.message);
    }
    return { id: assertRowsChanged(rows)[0].id as string };
  });

/** Lift an exclusion: it is ended, never deleted. */
export const endStaffExclusion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ exclusionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const { data: rows, error } = await sb
      .from("client_staff_exclusions")
      .update({ ended_at: new Date().toISOString(), ended_by: userId })
      .eq("id", data.exclusionId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("ended_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { ok: true };
  });

/** Add an office note. */
export const addClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ body: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const body = ok(cleanNoteBody(data.body));
    const { data: rows, error } = await sb
      .from("client_notes")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        body,
        created_by: userId,
      })
      .select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(rows)[0].id as string };
  });

/** Archive an office note (kept for the record). */
export const archiveClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ noteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const { data: rows, error } = await sb
      .from("client_notes")
      .update({ archived_at: new Date().toISOString(), archived_by: userId })
      .eq("id", data.noteId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("archived_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { ok: true };
  });
