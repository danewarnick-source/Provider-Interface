// Delete (hide) a client or team member made by mistake, and restore them.
// One set of server functions for both kinds. Every call checks the caller on
// the server ("Delete people" — Owners by default) before the database
// functions run their own org, permission and history checks. Nothing is ever
// removed: soft_delete_person sets deleted_at / deleted_by / delete_reason.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory, requireLevel } from "@/lib/access/require";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import {
  hasServiceHistory,
  historyBlockedMessage,
  historySummary,
  nameConfirmed,
  parseHistory,
  type ServiceHistory,
} from "./delete-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

/** id is clients.id for a client, the person's user id for a team member. */
const person = z.object({
  organizationId: z.string().uuid(),
  kind: z.enum(["client", "member"]),
  id: z.string().uuid(),
});
type Person = z.infer<typeof person>;

function signedIn(context: { supabase?: unknown; userId?: string | null }) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

async function memberName(sb: Sb, userId: string): Promise<string> {
  const { data, error } = await sb
    .from("profiles")
    .select("first_name, last_name, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const full = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
  return full || data?.full_name?.trim() || "This team member";
}

/** The row the database functions take, and the name to confirm. */
async function resolvePerson(sb: Sb, p: Person): Promise<{ rowId: string; name: string }> {
  if (p.kind === "client") {
    const { data, error } = await sb
      .from("clients")
      .select("id, first_name, last_name")
      .eq("organization_id", p.organizationId)
      .eq("id", p.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Client not found in this organization");
    return { rowId: data.id, name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() };
  }
  const { data, error } = await sb
    .from("organization_members")
    .select("id")
    .eq("organization_id", p.organizationId)
    .eq("user_id", p.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Team member not found in this organization");
  return { rowId: data.id, name: await memberName(sb, p.id) };
}

/** Server check for both kinds: "Delete people" on, plus the client guard for clients. */
async function guardDelete(sb: Sb, userId: string, p: Person) {
  await requireCategory(sb, userId, p.organizationId, "delete_people", "edit");
  if (p.kind === "client") {
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: p.organizationId,
      clientId: p.id,
      action: "view",
    });
  }
}

async function loadHistory(sb: Sb, kind: Person["kind"], rowId: string): Promise<ServiceHistory> {
  const { data, error } = await sb.rpc("person_service_history", { _kind: kind, _id: rowId });
  if (error) throw new Error(error.message);
  return parseHistory(data);
}

export type DeleteCheck = {
  name: string;
  canDelete: boolean;
  /** Why not, pointing to Discharge / Deactivate. Null when Delete is allowed. */
  blockedMessage: string | null;
  /** "3 shifts, 1 daily log" when there is history. */
  historyText: string;
};

/** What the Delete dialog shows before anything is typed. */
export const getDeleteCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => person.parse(d))
  .handler(async ({ data, context }): Promise<DeleteCheck> => {
    const { sb, userId } = signedIn(context);
    await guardDelete(sb, userId, data);
    const { rowId, name } = await resolvePerson(sb, data);
    const history = await loadHistory(sb, data.kind, rowId);
    const blocked = hasServiceHistory(history);
    return {
      name,
      canDelete: !blocked,
      blockedMessage: blocked ? historyBlockedMessage(data.kind, name) : null,
      historyText: historySummary(history),
    };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    person
      .extend({ reason: z.string().trim().min(1).max(300), typedName: z.string().max(200) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ name: string }> => {
    const { sb, userId } = signedIn(context);
    await guardDelete(sb, userId, data);
    const { rowId, name } = await resolvePerson(sb, data);
    if (!nameConfirmed(data.typedName, name)) {
      throw new Error(`Type ${name} exactly to confirm.`);
    }
    if (hasServiceHistory(await loadHistory(sb, data.kind, rowId))) {
      throw new Error(historyBlockedMessage(data.kind, name));
    }
    const { error } = await sb.rpc("soft_delete_person", {
      _kind: data.kind,
      _id: rowId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { name };
  });

export type DeletedPerson = {
  kind: Person["kind"];
  /** clients.id, or the team member's user id. */
  id: string;
  name: string;
  deletedAt: string;
  deletedByName: string;
  reason: string;
};

/** Settings → Recently deleted (Owners). Profiles are read separately, never embedded. */
export const listRecentlyDeleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeletedPerson[]> => {
    const { sb, userId } = signedIn(context);
    await requireLevel(sb, userId, data.organizationId, "owner");
    const [clientsQ, membersQ] = await Promise.all([
      sb
        .from("clients")
        .select("id, first_name, last_name, deleted_at, deleted_by, delete_reason")
        .eq("organization_id", data.organizationId)
        .not("deleted_at", "is", null),
      sb
        .from("organization_members")
        .select("user_id, deleted_at, deleted_by, delete_reason")
        .eq("organization_id", data.organizationId)
        .not("deleted_at", "is", null),
    ]);
    if (clientsQ.error) throw new Error(clientsQ.error.message);
    if (membersQ.error) throw new Error(membersQ.error.message);
    const members = membersQ.data ?? [];
    const clients = clientsQ.data ?? [];
    const userIds = [
      ...new Set(
        [
          ...members.map((m) => m.user_id),
          ...[...members, ...clients].map((r) => r.deleted_by),
        ].filter((x): x is string => !!x),
      ),
    ];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles, error } = await sb
        .from("profiles")
        .select("id, first_name, last_name, full_name")
        .in("id", userIds);
      if (error) throw new Error(error.message);
      for (const p of profiles ?? []) {
        const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
        names.set(p.id, full || p.full_name?.trim() || "Unknown");
      }
    }
    const rows: DeletedPerson[] = [
      ...clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        deletedAt: c.deleted_at as string,
        deletedByName: (c.deleted_by && names.get(c.deleted_by)) || "Unknown",
        reason: c.delete_reason ?? "",
      })),
      ...members.map((m) => ({
        kind: "member" as const,
        id: m.user_id,
        name: names.get(m.user_id) ?? "Unknown",
        deletedAt: m.deleted_at as string,
        deletedByName: (m.deleted_by && names.get(m.deleted_by)) || "Unknown",
        reason: m.delete_reason ?? "",
      })),
    ];
    return rows.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  });

/** Owners only. A restored team member comes back deactivated. */
export const restorePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => person.parse(d))
  .handler(async ({ data, context }): Promise<{ name: string }> => {
    const { sb, userId } = signedIn(context);
    await requireLevel(sb, userId, data.organizationId, "owner");
    const { rowId, name } = await resolvePerson(sb, data);
    const { error } = await sb.rpc("restore_deleted_person", { _kind: data.kind, _id: rowId });
    if (error) throw new Error(error.message);
    return { name };
  });
