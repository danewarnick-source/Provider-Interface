// Private notes about a team member (public.staff_notes). List needs Hire &
// deactivate View; add needs Hire & deactivate Edit. There is no edit and no
// delete — the table's RLS and grants allow neither.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import {
  STAFF_NOTE_KINDS,
  STAFF_NOTE_MAX,
  isStaffNoteKind,
  sortNotesNewestFirst,
  type StaffNote,
} from "@/lib/team-members/staff-notes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const Target = z.object({ organizationId: z.string().uuid(), staffId: z.string().uuid() });

async function assertStaffInOrg(admin: Sb, organizationId: string, staffId: string) {
  const { data, error } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", staffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Team member not found in this organization");
}

type NameRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};
const nameOf = (r: NameRow) =>
  r.full_name?.trim() || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "";

export const listStaffNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Target.parse(d))
  .handler(async ({ data, context }): Promise<StaffNote[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    await requireCategory(supabase as Sb, userId, data.organizationId, "staff_hiring", "view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;
    await assertStaffInOrg(admin, data.organizationId, data.staffId);

    const { data: rows, error } = await admin
      .from("staff_notes")
      .select("id, kind, body, created_at, author_id")
      .eq("organization_id", data.organizationId)
      .eq("staff_id", data.staffId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const notes = (rows ?? []) as Array<{
      id: string;
      kind: string;
      body: string;
      created_at: string;
      author_id: string;
    }>;

    // Author names from org_member_directory (as the signed-in viewer); people
    // no longer active there fall back to their profile, limited to this org.
    const authorIds = [...new Set(notes.map((n) => n.author_id))];
    const names = new Map<string, string>();
    if (authorIds.length) {
      const { data: dir } = await (supabase as Sb)
        .from("org_member_directory")
        .select("id, full_name, first_name, last_name")
        .in("id", authorIds);
      for (const r of (dir ?? []) as NameRow[]) if (nameOf(r)) names.set(r.id, nameOf(r));
      const missing = authorIds.filter((id) => !names.has(id));
      if (missing.length) {
        const { data: mems, error: memErr } = await admin
          .from("organization_members")
          .select("user_id")
          .is("deleted_at", null)
          .eq("organization_id", data.organizationId)
          .in("user_id", missing);
        if (memErr) throw new Error(memErr.message);
        const inOrg = (mems ?? []).map((m: { user_id: string }) => m.user_id);
        if (inOrg.length) {
          const { data: profs, error: pErr } = await admin
            .from("profiles")
            .select("id, full_name, first_name, last_name")
            .in("id", inOrg);
          if (pErr) throw new Error(pErr.message);
          for (const r of (profs ?? []) as NameRow[]) if (nameOf(r)) names.set(r.id, nameOf(r));
        }
      }
    }

    return sortNotesNewestFirst(
      notes.map((n) => ({
        id: n.id,
        kind: isStaffNoteKind(n.kind) ? n.kind : "note",
        body: n.body,
        createdAt: n.created_at,
        authorId: n.author_id,
        authorName: names.get(n.author_id) ?? "Former team member",
      })),
    );
  });

export const addStaffNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Target.extend({
      kind: z.enum(STAFF_NOTE_KINDS),
      body: z.string().trim().min(1).max(STAFF_NOTE_MAX),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    await requireCategory(supabase as Sb, userId, data.organizationId, "staff_hiring", "edit");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;
    await assertStaffInOrg(admin, data.organizationId, data.staffId);

    const { data: row, error } = await admin
      .from("staff_notes")
      .insert({
        organization_id: data.organizationId,
        staff_id: data.staffId,
        author_id: userId,
        kind: data.kind,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });
