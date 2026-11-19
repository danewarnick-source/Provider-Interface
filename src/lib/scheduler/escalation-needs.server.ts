// The escalation line on Needs you rows (call-outs, open shifts, 1:1 not
// covered): "Asked Maria (lead) 2:41 PM · on-call next at 2:56 PM", "Escalation
// stopped …" or "No one available · escalation finished", and whether Start
// escalation applies. Called by loadNeedsYou (needs.functions.ts) after the
// caller's scheduling check; service role, since the ladder names people the
// caller may not otherwise read.
import { currentRun, nextEscalationStep, runEnd } from "./escalation.ts";
import { escalationView } from "./escalation-view.ts";
import {
  ESC_SHIFT_COLUMNS,
  loadEscSettings,
  loadLadderEvents,
  loadLadderFacts,
  type EscShift,
} from "./escalation-load.server.ts";
import type { NeedItem } from "./needs-items.ts";
import { rows } from "./rule-staff-facts.server.ts";
import { staffNameMap } from "./staff-lookup.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const LADDER_KINDS = new Set<NeedItem["kind"]>(["callout", "open", "one_to_one"]);

export async function withEscalations(
  admin: Db,
  orgId: string,
  items: NeedItem[],
): Promise<NeedItem[]> {
  const ids = [
    ...new Set(items.filter((i) => LADDER_KINDS.has(i.kind) && i.shiftId).map((i) => i.shiftId!)),
  ];
  if (!ids.length) return items;
  const now = new Date();
  const [shifts, events, settings] = await Promise.all([
    rows<EscShift>(
      admin
        .from("scheduled_shifts")
        .select(ESC_SHIFT_COLUMNS)
        .eq("organization_id", orgId)
        .in("id", ids),
    ),
    loadLadderEvents(admin, ids),
    loadEscSettings(admin, [orgId]),
  ]);
  const running = shifts.filter((s) => {
    const run = currentRun(events.get(s.id) ?? []);
    return !!run && !runEnd(run);
  });
  const facts = await loadLadderFacts(admin, running, now);
  const people = [...events.values()].flat().flatMap((e) => ("userId" in e ? [e.userId] : []));
  for (const f of facts.values())
    people.push(...[f.candidates.lead, ...f.candidates.holdover].filter((x): x is string => !!x));
  const names = await staffNameMap(admin, people);
  const first = (id: string | null) => ((id && names.get(id)) || "Team member").split(/\s+/)[0]!;
  const set = settings.get(orgId)!;
  const byId = new Map(shifts.map((s) => [s.id, s]));
  return items.map((i) => {
    const s = i.shiftId ? byId.get(i.shiftId) : undefined;
    if (!s || !LADDER_KINDS.has(i.kind)) return i;
    const ev = events.get(s.id) ?? [];
    const f = facts.get(s.id);
    const step = f
      ? nextEscalationStep({
          shift: s,
          events: ev,
          waits: set.waits,
          holdoverAsk: set.holdoverAsk,
          candidates: f.candidates,
          now,
        })
      : ({ kind: "idle" } as const);
    const view = escalationView(ev, step, first);
    const live = s.status !== "cancelled" && new Date(s.ends_at) > now;
    const free = !s.staff_id || (i.kind === "callout" && s.staff_id === i.staffId);
    return {
      ...i,
      escalation: { ...view, canStart: view.state !== "running" && live && free },
    };
  });
}
