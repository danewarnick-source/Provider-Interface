// How the escalation ladder reads (escalation.ts). Pure. The Needs you line
// ("Asked Maria (lead) 2:41 PM · on-call next at 2:56 PM"), the drawer's
// "Who's been asked" steps, the My Schedule card and the push texts. Pushes
// and cards carry the code, day, time and the home's name, never a client's.
import { fmtClock } from "./board-model.ts";
import {
  currentRun,
  runEnd,
  RUNG_LABEL,
  type LadderEvent,
  type LadderStep,
  type Rung,
} from "./escalation.ts";
import { shiftWhen } from "./late-punch.ts";
import { dayKey, parseLocalDate } from "./time.ts";

type Names = (id: string | null) => string;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
  });

export type EscalationView = {
  state: "none" | "running" | "stopped" | "finished";
  line: string | null;
};

const who = (rung: Rung, ids: readonly string[], names: Names) => {
  const list = ids.map((id) => names(id)).join(", ");
  return rung === "holdover" ? `${list} to stay` : `${list} (${RUNG_LABEL[rung]})`;
};
const nextWho = (rung: Rung, ids: readonly string[], names: Names) =>
  rung === "lead"
    ? `${names(ids[0] ?? null)} (lead)`
    : rung === "holdover"
      ? `asking ${names(ids[0] ?? null)} to stay`
      : RUNG_LABEL[rung];

/** The Needs you line for a shift's ladder. `step` is nextEscalationStep for the same events. */
export function escalationView(
  events: readonly LadderEvent[],
  step: LadderStep,
  names: Names,
): EscalationView {
  const run = currentRun(events);
  if (!run) return { state: "none", line: null };
  const end = runEnd(run);
  const last = run[run.length - 1]!;
  if (end === "stopped") return { state: "stopped", line: `Escalation stopped ${time(last.at)}` };
  if (end === "finished" || (step.kind === "end" && step.why === "finished"))
    return { state: "finished", line: "No one available · escalation finished" };
  if (end || step.kind === "end" || step.kind === "idle") return { state: "none", line: null };
  const asks = run.filter((e): e is Extract<LadderEvent, { kind: "asked" }> => e.kind === "asked");
  if (step.kind === "wait") {
    const then = step.next
      ? `${nextWho(step.next.rung, step.next.targets, names)} next at ${time(step.until)}`
      : `no one else to ask after ${time(step.until)}`;
    return {
      state: "running",
      line: `Asked ${who(step.rung, step.asked, names)} ${time(step.askedAt)} · ${then}`,
    };
  }
  const prev = asks[asks.length - 1];
  const now = `${nextWho(step.rung, step.targets, names)} next`;
  return {
    state: "running",
    line: prev
      ? `Asked ${who(prev.rung, [prev.userId], names)} ${time(prev.at)} · ${now}`
      : `Escalation started · ${now}`,
  };
}

export type AskedLine = { key: string; at: string; text: string; answer: string };

/** The drawer's "Who's been asked": every ladder step, oldest first, with its answer. */
export function askedLines(events: readonly LadderEvent[], names: Names): AskedLine[] {
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const running = (() => {
    const run = currentRun(sorted);
    return !!run && !runEnd(run);
  })();
  return sorted.flatMap((e, i): AskedLine[] => {
    const key = `${e.kind}${i}`;
    if (e.kind === "started")
      return [
        {
          key,
          at: e.at,
          text: e.by ? `Started by ${names(e.by)}` : "Started automatically",
          answer: "",
        },
      ];
    if (e.kind === "stopped")
      return [{ key, at: e.at, text: `Stopped by ${names(e.by)}`, answer: "" }];
    if (e.kind === "finished") return [{ key, at: e.at, text: "No one available", answer: "" }];
    if (e.kind === "covered") return [{ key, at: e.at, text: "Shift covered", answer: "" }];
    if (e.kind === "answered") return [];
    const later = sorted.slice(i + 1);
    const reply = later.find(
      (x) => x.kind === "answered" && x.userId === e.userId && x.rung === e.rung,
    ) as Extract<LadderEvent, { kind: "answered" }> | undefined;
    const ended = later.some((x) => x.kind === "started");
    const answer = e.failed
      ? "Notice not sent"
      : reply
        ? reply.yes
          ? e.rung === "holdover"
            ? "Stayed"
            : "Took it"
          : "Can't"
        : running && !ended
          ? "No answer yet"
          : "No answer";
    return [{ key, at: e.at, text: who(e.rung, [e.userId], names), answer }];
  });
}

export type AskShift = {
  service_code: string | null;
  starts_at: string;
  ends_at: string;
};

const code = (s: AskShift) => (s.service_code ?? "").toUpperCase() || "Shift";
const weekday = (iso: string) =>
  parseLocalDate(dayKey(iso)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
  });
const at = (place: string) => (place ? ` at ${place}` : "");

/** The push to someone asked. `place` is the home's name or empty. */
export function askNotice(s: AskShift, rung: Rung, place: string) {
  if (rung === "holdover")
    return {
      title: "Can you stay?",
      body: `No one can cover ${code(s)} ${shiftWhen(s)}${at(place)}. Can you stay until ${fmtClock(s.ends_at)}? Open My Schedule to answer.`,
    };
  return {
    title: "Can you cover a shift?",
    body: `Can you cover ${code(s)} ${shiftWhen(s)}${at(place)}? Open My Schedule to take it.`,
  };
}

/** The notice to the owner(s) when no one was available. */
export function finishedNotice(s: AskShift, place: string) {
  return {
    title: "No one available",
    body: `No one took ${code(s)} ${shiftWhen(s)}${at(place)}. Escalation finished.`,
  };
}

/** The My Schedule card: "Can you cover Thu 3p–11p at Maple House?" with its yes button. */
export function askCard(s: AskShift, rung: Rung, place: string) {
  const span = `${fmtClock(s.starts_at)}–${fmtClock(s.ends_at)}`;
  if (rung === "holdover")
    return {
      title: `Can you stay until ${fmtClock(s.ends_at)}?`,
      detail: `No one can cover ${code(s)} ${weekday(s.starts_at)} ${span}${at(place)}.`,
      yes: `Stay until ${fmtClock(s.ends_at)}`,
    };
  return {
    title: `Can you cover ${weekday(s.starts_at)} ${span}${at(place)}?`,
    detail: `${code(s)} · ${shiftWhen(s)}`,
    yes: "Take it",
  };
}
