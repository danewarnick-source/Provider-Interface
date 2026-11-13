// Every change the scheduler board makes, and its Undo. Each change calls a
// server function (saveShift, cancelShift, restoreShift, offerOpenShifts), all
// of which run the rule engine; a block shows its reason in a toast and the
// board stays as it was. A "needs a reason" refusal opens the reason box and
// retries with the typed reason (saved on the shift). After each change a
// toast offers Undo for 10 s; Undo runs the inverse (move back, cancel what was
// added, restore what was cancelled, put the person back). The undo list lives
// in the browser only.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelShift, restoreShift, saveShift } from "@/lib/scheduler/scheduler.functions";
import { offerOpenShifts } from "@/lib/scheduler/offer.functions";
import { nextStatus, shiftWrite, type BoardShift } from "@/lib/scheduler/board-model";

const NEED_REASON = "Add a reason to go ahead:";
const TOAST_ID = "scheduler-board-change";

export type NewShift = Omit<ReturnType<typeof shiftWrite>, "id" | "organization_id">;
export type ReasonAsk = { message: string; retry: (reason: string) => Promise<boolean> };

const errText = (e: unknown) => (e instanceof Error ? e.message : "That didn't save. Try again.");

export function useBoardActions(orgId: string) {
  const qc = useQueryClient();
  const save = useServerFn(saveShift);
  const cancel = useServerFn(cancelShift);
  const restore = useServerFn(restoreShift);
  const offer = useServerFn(offerOpenShifts);
  const undoList = useRef<Array<() => Promise<unknown>>>([]);
  const [ask, setAsk] = useState<ReasonAsk | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
    void qc.invalidateQueries({ queryKey: ["open-shifts"] });
  };

  async function undoLast() {
    const inverse = undoList.current.pop();
    if (!inverse) return;
    try {
      await inverse();
      refresh();
      toast.success("Undone", { id: TOAST_ID });
    } catch (e) {
      toast.error(errText(e), { id: TOAST_ID });
    }
  }

  function done(
    message: string,
    inverse: (() => Promise<unknown>) | null,
    warnings: string[] = [],
  ) {
    if (inverse) undoList.current.push(inverse);
    refresh();
    toast.success(message, {
      id: TOAST_ID,
      duration: 10_000,
      description: warnings.length ? warnings.join(" · ") : undefined,
      action: inverse ? { label: "Undo", onClick: () => void undoLast() } : undefined,
    });
  }

  /** Runs a change; on "needs a reason" asks for one and runs it again with it. */
  async function attempt<T>(
    op: (reason: string | null) => Promise<T>,
    after: (r: T) => void,
  ): Promise<boolean> {
    try {
      after(await op(null));
      return true;
    } catch (e) {
      const msg = errText(e);
      if (!msg.startsWith(NEED_REASON)) {
        toast.error(msg, { id: TOAST_ID });
        return false;
      }
      setAsk({
        message: msg.slice(NEED_REASON.length).trim(),
        retry: async (reason) => {
          try {
            after(await op(reason));
            setAsk(null);
            return true;
          } catch (e2) {
            toast.error(errText(e2), { id: TOAST_ID });
            return false;
          }
        },
      });
      return false;
    }
  }

  const put = (s: BoardShift, patch: Partial<BoardShift> = {}) =>
    save({ data: shiftWrite(orgId, s, patch) });
  const cancelIds = (ids: string[]) =>
    Promise.all(ids.map((id) => cancel({ data: { id, organization_id: orgId } })));

  return {
    ask,
    closeAsk: () => setAsk(null),

    /** Move, retime, edit or reassign. `reason` is one typed up front (Add shift, Find staff). */
    update(
      s: BoardShift,
      patch: Partial<BoardShift>,
      message: string,
      reason: string | null = null,
    ) {
      const status = nextStatus(s, patch.staff_id !== undefined ? patch.staff_id : s.staff_id);
      return attempt(
        (r) => put(s, { status, ...patch, override_reason: r ?? reason }),
        (res) => done(message, () => put(s), res.warnings),
      );
    },

    /** Adds shifts (N open spots are N shifts); open ones are offered to everyone qualified. */
    create(rows: NewShift[], message: string, reason: string | null = null) {
      return attempt(
        async (r) => {
          const ids: string[] = [];
          const warnings: string[] = [];
          for (const row of rows) {
            const res = await save({
              data: { ...row, organization_id: orgId, override_reason: r ?? reason },
            });
            ids.push(res.id);
            warnings.push(...res.warnings);
          }
          const open = rows.every((row) => !row.staff_id);
          const offered = open
            ? await offer({ data: { organization_id: orgId, shift_ids: ids } })
            : null;
          return { ids, warnings, offered };
        },
        ({ ids, warnings, offered }) =>
          done(
            offered ? `Offered to ${offered.people} qualified` : message,
            () => cancelIds(ids),
            warnings,
          ),
      );
    },

    cancel(s: BoardShift) {
      return attempt(
        () => cancel({ data: { id: s.id, organization_id: orgId } }),
        () =>
          done("Shift cancelled", () =>
            restore({
              data: { id: s.id, organization_id: orgId, override_reason: s.override_reason },
            }),
          ),
      );
    },

    restore(s: BoardShift) {
      return attempt(
        (r) => restore({ data: { id: s.id, organization_id: orgId, override_reason: r } }),
        (res) => done("Shift restored", () => cancelIds([s.id]), res.warnings),
      );
    },

    /** No one on it any more; it stays on the board and is offered. Undo puts the person back. */
    makeOpen(s: BoardShift) {
      return attempt(
        async () => {
          await put(s, { staff_id: null, status: "open", open_spots: 1, override_reason: null });
          return offer({ data: { organization_id: orgId, shift_ids: [s.id] } });
        },
        (r) => done(`Shift is open · offered to ${r.people}`, () => put(s)),
      );
    },

    offer(ids: string[]) {
      return attempt(
        () => offer({ data: { organization_id: orgId, shift_ids: ids } }),
        (r) => done(`Offered to ${r.people}`, null),
      );
    },
  };
}

export type BoardActions = ReturnType<typeof useBoardActions>;
