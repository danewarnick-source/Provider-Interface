// Shared state for one scheduler board: the loaded data and rule findings,
// lookups by id, whether the viewer may edit, the change actions (with Undo),
// the unsent changes to published shifts (B4) and which drawer or dialog is
// open. Provided by scheduler-board.tsx; every board component reads it with
// useBoard() instead of threading props.
import { createContext, useContext, type ReactNode } from "react";
import type { Check } from "@/lib/scheduler/find-staff.functions";
import type { BoardClient, BoardShift, BoardTeam } from "@/lib/scheduler/board-model";
import type { BoardActions } from "./use-board-actions";
import type { BoardData, BoardStaff } from "@/lib/scheduler/board-data";
import type { NetChange } from "@/lib/scheduler/shift-change";

/** What Add shift starts from. `lock` = the team member was picked from their row's +. */
export type AddDraft = {
  day: string;
  placeKey: string | null;
  staffId: string | null;
  lock: boolean;
  editId: string | null;
  start: string;
  end: string;
  shiftType: string | null;
};

/** A dialog a drawer goes back to when it closes (Publish › Open shift). */
export type Back = "publish";

export type Panel =
  | { kind: "shift"; id: string; back?: Back }
  | { kind: "add"; draft: AddDraft; back?: Back }
  | { kind: "find"; id: string; back?: Back }
  | { kind: "list"; which: "hours" | "open" | "ot"; back?: Back }
  | { kind: "publish"; back?: undefined }
  | { kind: "copy"; back?: undefined };

export type Board = {
  orgId: string;
  data: BoardData;
  checks: Record<string, Check[]>;
  days: string[];
  canEdit: boolean;
  actions: BoardActions;
  clients: ReadonlyMap<string, BoardClient>;
  teams: ReadonlyMap<string, BoardTeam>;
  staff: ReadonlyMap<string, BoardStaff>;
  /** Live shifts (not cancelled) plus cancelled ones, as loaded. */
  shifts: BoardShift[];
  /** Unsent changes to published shifts that tell someone something, one per shift. */
  changes: NetChange[];
  /** Shift ids with an unsent change ("Changed · not sent"). */
  changed: ReadonlySet<string>;
  open: (p: Panel) => void;
  close: () => void;
};

const Ctx = createContext<Board | null>(null);

export function BoardProvider({ value, children }: { value: Board; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBoard(): Board {
  const b = useContext(Ctx);
  if (!b) throw new Error("useBoard outside the scheduler board");
  return b;
}

/** Findings shown for a shift: a reason already saved on it satisfies "needs a reason". */
export function shiftFlags(b: Board, s: BoardShift): Check[] {
  const list = b.checks[s.id] ?? [];
  return s.override_reason
    ? list.map((c) => (c.level === "reason" ? { ...c, level: "warn" as const } : c))
    : list;
}

export const staffName = (b: Board, id: string | null) =>
  id ? (b.staff.get(id)?.name ?? "Team member") : "Open";
export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
