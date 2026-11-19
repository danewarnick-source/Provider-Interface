// Settings › Open shifts › Hold-over record: every active team member, next
// up first (holdoverRecord in holdover.ts), from the hold-overs on record
// (shift_changes kind 'holdover'). Anyone with Scheduling view reads it; other
// members only while the agency's "Staff can see the hold-over list"
// (holdover_visible) is on. Read with the service role after that check,
// because staff can read only the shift_changes rows that name them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { hasCategory } from "@/lib/access/can";
import { holdoverRecord, type HoldoverLine } from "@/lib/scheduler/holdover";
import { loadEscSettings, loadHoldoverRecords } from "@/lib/scheduler/escalation-load.server";
import { loadActiveStaffNames } from "@/lib/scheduler/staff-lookup";

export const loadHoldoverRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<HoldoverLine[]> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    const org = data.organization_id;
    const access = await requireOrgMembership(supabase, userId, org);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!hasCategory(access.categories, "scheduling", "view")) {
      const settings = (await loadEscSettings(supabaseAdmin, [org])).get(org)!;
      if (!settings.holdoverVisible)
        throw new Error("Your agency keeps the hold-over list private.");
    }
    const [people, records] = await Promise.all([
      loadActiveStaffNames(supabaseAdmin, org),
      loadHoldoverRecords(supabaseAdmin, [org]),
    ]);
    return holdoverRecord(people, records, new Date());
  });
