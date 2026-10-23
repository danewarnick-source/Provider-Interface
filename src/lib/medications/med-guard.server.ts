// Shared server-side guard for medication server functions that work on a
// client: signed in, the client exists, and assertCanManageClient passes
// for the action. Returns the service client and storage only after that.

import { assertCanManageClient } from "@/lib/clients/guards.server";
import type { Sb } from "./meds-write";

export type MedStorage = {
  from: (bucket: string) => {
    upload: (
      path: string,
      body: Uint8Array,
      o: { contentType: string; upsert: boolean },
    ) => Promise<{ error: { message: string } | null }>;
    createSignedUrl: (
      path: string,
      seconds: number,
    ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  };
};

export interface GuardedClient {
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  medicaid_id: string | null;
  allergies: string[] | null;
  dysphagia: boolean | null;
  swallowing_alerts: string[] | null;
}

export async function medAdmin(): Promise<{ db: Sb; storage: MedStorage }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    db: supabaseAdmin as unknown as Sb,
    storage: (supabaseAdmin as unknown as { storage: MedStorage }).storage,
  };
}

/** Signed in, the client exists, and the caller may do `action` for them. */
export async function guardClient(
  context: { userId?: string | null; supabase?: unknown },
  db: Sb,
  clientId: string,
  action: "view_medical" | "edit_medical",
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const { data, error } = await db
    .from("clients")
    .select(
      "organization_id, first_name, last_name, date_of_birth, medicaid_id, allergies, dysphagia, swallowing_alerts",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found.");
  const client = data as GuardedClient;
  await assertCanManageClient({
    supabase: context.supabase as Parameters<typeof assertCanManageClient>[0]["supabase"],
    actorId: context.userId,
    organizationId: client.organization_id,
    clientId,
    action,
  });
  return { userId: context.userId, client };
}

export function clientName(c: Pick<GuardedClient, "first_name" | "last_name">): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client";
}
