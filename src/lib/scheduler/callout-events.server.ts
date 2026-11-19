// The one writer of call-out events (callout_escalation_events rows with a
// callout_id): calling out and locking coverage (callout.functions.ts) and
// Done on Needs you (acknowledgeCallout, needs.functions.ts). Escalation
// ladder rows (scheduled_shift_id) are written by escalation.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type CalloutEvent = {
  channel: "in_app" | "system";
  target_role: string | null;
  target_user_id?: string | null;
  outcome: "sent" | "acknowledged" | "failed";
  detail: string;
};

/** Logs one call-out step (numbered after the ones before). A failed log never undoes the action. */
export async function addCalloutEvent(db: Db, orgId: string, calloutId: string, e: CalloutEvent) {
  const { count } = await db
    .from("callout_escalation_events")
    .select("id", { count: "exact", head: true })
    .eq("callout_id", calloutId);
  const { error } = await db.from("callout_escalation_events").insert({
    organization_id: orgId,
    callout_id: calloutId,
    step: (count ?? 0) + 1,
    target_user_id: null,
    ...e,
  });
  if (error) console.error(`[callout] event insert failed: ${error.message}`);
}
