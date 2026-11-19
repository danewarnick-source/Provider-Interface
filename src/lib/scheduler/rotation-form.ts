// The Rotations screen's form logic (B6). Pure; no I/O.
//   rotationPlaces  the tabs: each staffed home or program (its code), then
//                   each client with an active 1056 code someone is scheduled
//                   under (their codes).
//   EditorState     what the rotation editor holds; stateFromLine / newState.
//   editorInput     the editor → the input saveRotation and previewRotation
//                   take, or why Save is disabled.
//   lineFromInput   that input → a RotationLine (the server stores exactly this).
import {
  clientName,
  codeActiveOn,
  homeCode,
  HOME_ONLY_CODES,
  type BoardClient,
  type BoardTeam,
  type CodeRow,
} from "./board-model.ts";
import {
  parseCycle,
  patternKind,
  PATTERNS,
  type PatternKind,
  type RotationLine,
} from "./rotation.ts";
import { weekdayOf } from "./time.ts";

export type RotationPlace = {
  key: string;
  label: string;
  teamId: string | null;
  clientId: string | null;
  codes: string[];
  /** Which B2 shift types apply (shift_types.used_at). */
  usedAt: "home" | "program" | "client";
};

export function rotationPlaces(
  teams: readonly BoardTeam[],
  clients: readonly BoardClient[],
  codes: readonly CodeRow[],
  today: string,
): RotationPlace[] {
  const homes = teams.flatMap((t): RotationPlace[] => {
    const code = homeCode(t.team_type);
    if (!code) return [];
    const usedAt = code === "RHS" ? "home" : "program";
    return [
      {
        key: `team:${t.id}`,
        label: t.team_name,
        teamId: t.id,
        clientId: null,
        codes: [code],
        usedAt,
      },
    ];
  });
  const byClient = new Map<string, string[]>();
  for (const c of codes) {
    const code = c.service_code.toUpperCase();
    if (HOME_ONLY_CODES.has(code) || !codeActiveOn(c, today)) continue;
    const list = byClient.get(c.client_id) ?? [];
    if (!list.includes(code)) byClient.set(c.client_id, [...list, code].sort());
  }
  const people = clients
    .filter((c) => byClient.has(c.id))
    .map((c): RotationPlace => ({
      key: `client:${c.id}`,
      label: clientName(c),
      teamId: null,
      clientId: c.id,
      codes: byClient.get(c.id)!,
      usedAt: "client",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...homes, ...people];
}

export const placeKeyOf = (l: Pick<RotationLine, "team_id" | "client_id">) =>
  l.team_id ? `team:${l.team_id}` : `client:${l.client_id}`;

/** What saveRotation and previewRotation take (besides the agency). */
export type RotationInput = {
  id?: string;
  staff_id: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string;
  shift_type: string | null;
  cycle: number[] | null;
  weekday_mask: number;
  starts_on: string;
  start_time: string;
  end_time: string;
  ends_on: string | null;
};

export function lineFromInput(d: RotationInput, id: string): RotationLine {
  return {
    id,
    staff_id: d.staff_id,
    client_id: d.client_id,
    team_id: d.team_id,
    service_code: d.service_code.toUpperCase(),
    shift_type: d.shift_type,
    cycle: d.cycle,
    cycle_start: d.cycle ? d.starts_on : null,
    weekday_mask: d.cycle ? 0 : d.weekday_mask,
    start_time_local: d.start_time.slice(0, 5),
    end_time_local: d.end_time.slice(0, 5),
    effective_from: d.starts_on,
    effective_until: d.ends_on,
    active: true,
  };
}

export type EditorState = {
  id: string | null;
  placeKey: string;
  /** A staff id, "open", or "" before anyone is picked. */
  who: string;
  code: string;
  kind: PatternKind;
  mask: number;
  customText: string;
  /** A shift type key, or null for a custom time. */
  shiftType: string | null;
  start: string;
  end: string;
  startsOn: string;
  endsOn: string | null;
};

export function newState(place: RotationPlace | null, today: string): EditorState {
  return {
    id: null,
    placeKey: place?.key ?? "",
    who: "",
    code: place?.codes[0] ?? "",
    kind: "5-2",
    mask: 0b0111110,
    customText: "6-1",
    shiftType: null,
    start: "07:00",
    end: "15:00",
    startsOn: today,
    endsOn: null,
  };
}

export function stateFromLine(l: RotationLine): EditorState {
  const kind = patternKind(l);
  return {
    id: l.id,
    placeKey: placeKeyOf(l),
    who: l.staff_id ?? "open",
    code: (l.service_code ?? "").toUpperCase(),
    kind,
    mask: l.weekday_mask || 0b0111110,
    customText: kind === "custom" ? (l.cycle ?? []).join("-") : "6-1",
    shiftType: l.shift_type && l.shift_type !== "hourly" ? l.shift_type : null,
    start: l.start_time_local.slice(0, 5),
    end: l.end_time_local.slice(0, 5),
    startsOn: l.cycle_start ?? l.effective_from,
    endsOn: l.effective_until,
  };
}

export type EditorCheck = { input: RotationInput; why: null } | { input: null; why: string };

export function editorInput(s: EditorState, place: RotationPlace | null): EditorCheck {
  const no = (why: string): EditorCheck => ({ input: null, why });
  if (!place) return no("Pick where the rotation is.");
  if (!s.who) return no("Pick who works it, or Open.");
  if (!place.codes.includes(s.code)) return no("Pick the service code.");
  const preset = PATTERNS.find((p) => p.kind === s.kind)!;
  const cycle =
    s.kind === "weekdays"
      ? null
      : s.kind === "custom"
        ? parseCycle(s.customText)
        : [...preset.cycle!];
  if (s.kind === "custom" && !cycle)
    return no("Type the days on and off, starting with on, like 6-1 or 3-2-2-3.");
  if (s.kind === "weekdays" && !s.mask) return no("Pick at least one weekday.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.startsOn)) return no("Pick the day the cycle starts.");
  if (s.kind === "alt-weekend" && weekdayOf(s.startsOn) !== 6)
    return no("Every other weekend starts on a Saturday.");
  if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end) || s.start === s.end)
    return no("Pick the shift's times.");
  if (s.endsOn && s.endsOn < s.startsOn) return no("The last day is before the first.");
  return {
    why: null,
    input: {
      ...(s.id ? { id: s.id } : {}),
      staff_id: s.who === "open" ? null : s.who,
      client_id: place.clientId,
      team_id: place.teamId,
      service_code: s.code,
      shift_type: s.shiftType,
      cycle,
      weekday_mask: s.kind === "weekdays" ? s.mask : 0,
      starts_on: s.startsOn,
      start_time: s.start,
      end_time: s.end,
      ends_on: s.endsOn,
    },
  };
}
