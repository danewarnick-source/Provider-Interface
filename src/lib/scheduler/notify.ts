// Scheduler notifications. supabase-js returns insert errors instead of
// throwing, so a bare `await ...insert()` inside try/catch swallows them.
// This logs the failure (type and message only, never the body) and returns
// whether the rows were saved. A failed notification never blocks the action.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type SchedulerNotification = {
  organization_id: string;
  type: string;
  title: string;
  body: string;
  recipient_role?: string;
  recipient_user_id?: string;
  urgency?: string;
  link_to?: string;
  related_id?: string;
  related_type?: string;
};

export async function notify(
  supabase: Db,
  rows: SchedulerNotification | SchedulerNotification[],
): Promise<boolean> {
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) return true;
  try {
    const { error } = await supabase.from("notifications").insert(list);
    if (error) {
      console.error(
        `[scheduler] notification insert failed (${list.map((r) => r.type).join(",")}): ${error.message}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[scheduler] notification insert threw: ${e instanceof Error ? e.message : "unknown"}`);
    return false;
  }
}
