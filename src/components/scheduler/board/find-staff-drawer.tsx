// Find staff for one shift ("Give it to someone else" on a staffed shift,
// "Find staff" on an open one): the ranked list with Nectar's pick on top,
// Assign / Assign with a reason, and "Offer to N qualified instead".
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { findStaff } from "@/lib/scheduler/find-staff.functions";
import { isQualified } from "@/lib/scheduler/rank-staff";
import { fmtSpan, shiftHours, type BoardShift } from "@/lib/scheduler/board-model";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { dayKey } from "@/lib/scheduler/time";
import { firstName, staffName, useBoard } from "./board-context";
import { DrawerShell } from "./board-ui";
import { placeLabel } from "./shift-chip";
import { AssignList, nectarPick } from "./who-list";

export type Proposed = {
  id?: string;
  staff_id?: string | null;
  client_id: string | null;
  team_id: string | null;
  service_code: string;
  starts_at: string;
  ends_at: string;
  shift_type?: string | null;
  parent_shift_id?: string | null;
};

export function useFindStaff(orgId: string, shift: Proposed | null) {
  const run = useServerFn(findStaff);
  return useQuery({
    enabled: !!shift,
    queryKey: ["scheduler-board", "find", orgId, shift],
    queryFn: () => run({ data: { organization_id: orgId, shift: { ...shift!, staff_id: null } } }),
  });
}

export const proposedOf = (s: BoardShift): Proposed => ({
  id: s.id,
  client_id: s.client_id,
  team_id: s.team_id,
  service_code: s.service_code ?? "",
  starts_at: s.starts_at,
  ends_at: s.ends_at,
  shift_type: s.shift_type,
  parent_shift_id: s.parent_shift_id,
});

export function FindStaffDrawer({ s }: { s: BoardShift }) {
  const b = useBoard();
  const { data, isLoading, error } = useFindStaff(b.orgId, proposedOf(s));
  const list = (data ?? []).filter((c) => c.staffId !== s.staff_id);
  const qualified = list.filter(isQualified).length;
  const pick = nectarPick(list);
  const add = shiftHours(s);
  return (
    <DrawerShell
      open
      onClose={b.close}
      kicker="Find staff"
      title="Who should take it?"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={b.close}>
            Close
          </Button>
          {qualified > 0 && (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                if (s.staff_id ? await b.actions.makeOpen(s) : await b.actions.offer([s.id]))
                  b.close();
              }}
            >
              Offer to {qualified} qualified instead
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm">
        {placeLabel(b, s)} · {fmtDay(dayKey(s.starts_at))} {fmtSpan(s)} · {s.service_code}
        {s.staff_id && ` · now ${staffName(b, s.staff_id)}`}
      </p>
      <p className="text-xs text-[var(--hive-text-muted)]">
        Cards and training come from Evidence. Anyone who can't take it says why, with a link to fix
        it.
      </p>
      {pick && (
        <div className="rounded-md bg-[var(--hive-gold-soft)] p-3 text-sm">
          <b>Nectar's pick: {pick.name}</b>
          <div>
            Fewest hours among people with no flags ({pick.hoursThisWeek} h →{" "}
            {Math.round((pick.hoursThisWeek + add) * 100) / 100} h).
          </div>
        </div>
      )}
      {isLoading && (
        <p className="text-sm text-[var(--hive-text-muted)]">
          Checking everyone against the rules…
        </p>
      )}
      {error && <p className="text-sm text-[var(--hive-danger)]">{error.message}</p>}
      {data && (
        <AssignList
          list={list}
          add={add}
          onAssign={async (id, reason) => {
            const ok = await b.actions.update(
              s,
              { staff_id: id, open_spots: null },
              `Assigned to ${firstName(staffName(b, id))}`,
              reason,
            );
            if (ok) b.close();
            return ok;
          }}
        />
      )}
    </DrawerShell>
  );
}
