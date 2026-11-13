// Add shift (and Edit day, place or time): 1. Day → 2. Where → 3. Time →
// 4. Who, ranked best fit first by the rule engine, or Leave it open with 1–3
// spots (offered to everyone qualified). Locked to a team member when opened
// from their row's +. A "needs a reason" finding asks for the reason, which is
// saved on the shift; a block disables Save and says why. Saving goes through
// use-board-actions.ts (rule engine, Undo).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shiftChecks } from "@/lib/scheduler/find-staff.functions";
import { fitLevel } from "@/lib/scheduler/rank-staff";
import { timesOn, type BoardShift } from "@/lib/scheduler/board-model";
import { firstName, staffName, useBoard, type AddDraft } from "./board-context";
import { placesFor, typesFor } from "./add-draft";
import { DayStep, Field, SpotsStep, TimeStep, WhereStep } from "./add-shift-steps";
import { DrawerShell } from "./board-ui";
import { useFindStaff, type Proposed } from "./find-staff-drawer";
import type { NewShift } from "./use-board-actions";
import { PickList } from "./who-list";

function useLockedChecks(orgId: string, p: Proposed | null) {
  const run = useServerFn(shiftChecks);
  return useQuery({
    enabled: !!p?.staff_id,
    queryKey: ["scheduler-board", "checks-one", orgId, p],
    queryFn: () => run({ data: { organization_id: orgId, shift: p! } }),
  });
}

export function AddShiftDrawer({ initial }: { initial: AddDraft }) {
  const b = useBoard();
  const [d, setD] = useState(initial);
  const [spots, setSpots] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AddDraft>) => setD((x) => ({ ...x, ...p }));
  const editing: BoardShift | undefined = d.editId
    ? b.shifts.find((s) => s.id === d.editId)
    : undefined;
  const places = placesFor(b, d.day, d.lock ? d.staffId : null);
  const place = places.find((p) => p.key === d.placeKey) ?? null;
  const times = timesOn(d.day, d.start, d.end);
  const keepTeam =
    editing && place?.clientId && editing.client_id === place.clientId ? editing.team_id : null;
  // A new object each render is fine: React Query keys hash by value.
  const proposed: Proposed | null = place && {
    id: d.editId ?? undefined,
    client_id: place.clientId,
    team_id: place.teamId ?? keepTeam,
    service_code: place.code,
    ...times,
    shift_type: d.shiftType,
    parent_shift_id: editing?.parent_shift_id ?? null,
  };
  const ranked = useFindStaff(b.orgId, d.lock ? null : proposed);
  const locked = useLockedChecks(
    b.orgId,
    d.lock && proposed ? { ...proposed, staff_id: d.staffId } : null,
  );
  const chosen = d.lock ? null : (ranked.data?.find((c) => c.staffId === d.staffId) ?? null);
  const level = d.lock ? (locked.data ? fitLevel(locked.data) : null) : (chosen?.level ?? null);
  const reasons = d.lock ? (locked.data ?? []).map((f) => f.message) : (chosen?.reasons ?? []);
  const blocked = level === "cant";
  const needsReason = level === "reason" && reason.trim().length < 3;
  const hours =
    (new Date(times.ends_at).getTime() - new Date(times.starts_at).getTime()) / 3_600_000;
  const who = d.staffId ? firstName(staffName(b, d.staffId)) : null;

  async function save() {
    if (!place) return;
    setBusy(true);
    const r = level === "reason" ? reason.trim() : null;
    const base = {
      client_id: place.clientId,
      team_id: place.teamId ?? keepTeam,
      service_code: place.code,
      ...times,
    };
    let ok: boolean;
    if (editing) {
      ok = await b.actions.update(
        editing,
        { ...base, staff_id: d.staffId, shift_type: d.shiftType ?? editing.shift_type },
        "Shift saved",
        r,
      );
    } else {
      const row: NewShift = {
        ...base,
        staff_id: d.staffId,
        shift_type: d.shiftType ?? "hourly",
        status: d.staffId ? "draft" : "open",
        published: false,
        notes: null,
        override_reason: null,
        open_spots: d.staffId ? null : 1,
        parent_shift_id: null,
      };
      ok = await b.actions.create(
        d.staffId ? [row] : Array.from({ length: spots }, () => row),
        "Shift added",
        r,
      );
    }
    setBusy(false);
    if (ok) b.close();
  }

  const label = editing
    ? "Save changes"
    : d.lock
      ? `Add shift for ${who}`
      : d.staffId
        ? "Add shift"
        : `Add ${spots} open shift${spots > 1 ? "s" : ""} and offer`;
  const why = !place
    ? "Pick where the shift is first."
    : blocked
      ? `${reasons[0] ?? "This person can't take it"}. Pick another time, place or person.`
      : needsReason
        ? "Type why this works anyway."
        : null;
  return (
    <DrawerShell
      open
      onClose={b.close}
      kicker={editing ? "Edit shift" : "Add a shift"}
      title={editing ? "Edit shift" : "Add a shift"}
      dirty={JSON.stringify(d) !== JSON.stringify(initial) || reason !== ""}
      footer={
        <>
          {why && (
            <span className="mr-auto self-center text-xs font-semibold text-[var(--hive-danger)]">
              {why}
            </span>
          )}
          <Button variant="outline" className="min-h-11" onClick={b.close}>
            Cancel
          </Button>
          <Button
            className="min-h-11"
            disabled={!!why || busy}
            title={why ?? undefined}
            onClick={() => void save()}
          >
            {label}
          </Button>
        </>
      }
    >
      <DayStep days={b.days} value={d.day} onChange={(day) => set({ day })} />
      {d.lock && d.staffId && (
        <div className="rounded-md border border-[var(--hive-gold)] bg-[var(--hive-gold-soft)] p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <b>For {staffName(b, d.staffId)}</b>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => set({ lock: false })}
            >
              Pick someone else
            </Button>
          </div>
          <div className="text-xs">
            {locked.isLoading
              ? "Checking…"
              : reasons.length
                ? reasons.join("; ")
                : place
                  ? "No flags"
                  : ""}
          </div>
        </div>
      )}
      <WhereStep
        places={places}
        value={d.placeKey}
        lockedName={d.lock ? who : null}
        onChange={(p) => {
          const t = typesFor(b, p.usedAt)[0];
          set({
            placeKey: p.key,
            ...(t
              ? { start: t.start_time.slice(0, 5), end: t.end_time.slice(0, 5), shiftType: t.key }
              : {}),
          });
        }}
      />
      {place && <TimeStep draft={d} types={typesFor(b, place.usedAt)} onChange={set} />}
      {!d.lock && place && (
        <Field
          label="4. Who"
          hint="Best fit first. People who can't take it show why, so you never call down a list."
        >
          {ranked.isLoading && (
            <p className="text-sm text-[var(--hive-text-muted)]">
              Checking everyone against the rules…
            </p>
          )}
          {ranked.error && (
            <p className="text-sm text-[var(--hive-danger)]">{ranked.error.message}</p>
          )}
          {ranked.data && (
            <PickList
              list={ranked.data}
              add={hours}
              selected={d.staffId}
              onPick={(staffId) => set({ staffId })}
            />
          )}
        </Field>
      )}
      {level === "reason" && (
        <Field
          label="Why this works anyway (required)"
          hint={`${reasons.join("; ")}. Your agency asks for a reason; it's saved on the shift.`}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. She asked for the extra hours; no one else is trained on this client"
          />
        </Field>
      )}
      {!d.staffId && !editing && place && <SpotsStep value={spots} onChange={setSpots} />}
    </DrawerShell>
  );
}
