// access_change_log writer shared by Access & presets and hiring.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function nameOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin.from("org_member_directory").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? null;
}

export async function logChange(
  orgId: string,
  byUserId: string,
  changeType: string,
  target: { userId?: string | null; name?: string | null },
  details: Record<string, unknown>,
) {
  const [byName, targetName] = await Promise.all([nameOf(byUserId), target.name ?? nameOf(target.userId ?? null)]);
  await supabaseAdmin.from("access_change_log").insert({
    organization_id: orgId,
    changed_by_user_id: byUserId,
    changed_by_name: byName ?? "Unknown",
    change_type: changeType,
    target_user_id: target.userId ?? null,
    target_user_name: targetName ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: details as any,
  });
}
