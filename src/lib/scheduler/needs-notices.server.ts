// The notifications Needs you (B5) sends and reads back. Each kind is an
// allowed notifications.type plus its own related_type, so it can be found
// again: the late-clock-in nudge and lead alert (late-alerts.server.ts), "Ask
// them to fix their punch" and "Send a reminder" (needs.functions.ts). The
// notification row is the record that it was sent, so each goes once.
// Reads use the service role: staff notifications are readable only by their
// recipient, so every caller checks scheduling access first.
import { OFFER_TYPE } from "./offer.server.ts";
import { rows } from "./rule-staff-facts.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type NoticeMarker = { type: string; related_type: string };

export const LATE_NUDGE: NoticeMarker = {
  type: "timesheet_exception",
  related_type: "shift_late_nudge",
};
export const LATE_LEAD: NoticeMarker = {
  type: "timesheet_exception",
  related_type: "shift_late_lead",
};
export const ASK_PUNCH: NoticeMarker = {
  type: "timesheet_exception",
  related_type: "punch_fix_ask",
};
export const CARD_REMINDER: NoticeMarker = {
  type: "smart_import_cert_expiring",
  related_type: "card_reminder",
};
const OFFER: NoticeMarker = { type: OFFER_TYPE, related_type: "scheduled_shift" };

type Sent = { recipient_user_id: string | null; related_id: string | null; created_at: string };

/** Notices of one marker about these ids (optionally since an instant). */
export async function sentNotices(
  admin: Db,
  orgId: string | null,
  marker: NoticeMarker,
  relatedIds: readonly string[],
  since?: string,
): Promise<Sent[]> {
  if (!relatedIds.length) return [];
  let q = admin
    .from("notifications")
    .select("recipient_user_id, related_id, created_at")
    .eq("type", marker.type)
    .eq("related_type", marker.related_type)
    .in("related_id", relatedIds);
  if (orgId) q = q.eq("organization_id", orgId);
  if (since) q = q.gte("created_at", since);
  return rows<Sent>(q);
}

/** For Needs you: who each open shift was offered to, punch-fix asks, today's card reminders. */
export async function needsNotices(
  admin: Db,
  orgId: string,
  ids: { open: string[]; started: string[]; staff: string[]; todayStart: string },
) {
  const [offers, asks, reminders] = await Promise.all([
    sentNotices(admin, orgId, OFFER, ids.open),
    sentNotices(admin, orgId, ASK_PUNCH, ids.started),
    sentNotices(admin, orgId, CARD_REMINDER, ids.staff, ids.todayStart),
  ]);
  const offered = new Map<string, Set<string>>();
  for (const o of offers)
    if (o.related_id && o.recipient_user_id)
      offered.set(o.related_id, (offered.get(o.related_id) ?? new Set()).add(o.recipient_user_id));
  const by = (list: Sent[]) =>
    new Map(list.filter((r) => r.related_id).map((r) => [r.related_id!, r.created_at] as const));
  return {
    offers: new Map([...offered].map(([k, v]) => [k, v.size])),
    asked: by(asks),
    reminded: by(reminders),
  };
}
