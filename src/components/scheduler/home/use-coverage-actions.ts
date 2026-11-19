// Saves behind coverage (B7): "no staff needed" blocks (save, remove with
// Undo) and residents' away times (add, remove). Each one refreshes the board,
// the home page and Needs you so the bars, the tile and the gap rows move
// together. Used by the gap dialog, the home page and the client profile.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { removeNoStaffBlock, saveNoStaffBlock } from "@/lib/homes/no-staff.functions";
import { draftFromBlock, type NoStaffBlock, type NoStaffDraft } from "@/lib/homes/no-staff";
import { addAwayTime, archiveAwayTime } from "@/lib/clients/away-times.functions";
import type { AwayDraft } from "@/lib/clients/away-times";

const errText = (e: unknown) => (e instanceof Error ? e.message : "That didn't save. Try again.");

export function useCoverageActions(orgId: string) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveNoStaffBlock);
  const removeFn = useServerFn(removeNoStaffBlock);
  const addAwayFn = useServerFn(addAwayTime);
  const archiveAwayFn = useServerFn(archiveAwayTime);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    for (const key of ["scheduler-board", "needs-you", "home-residents", "client-away-times"])
      void qc.invalidateQueries({ queryKey: [key] });
  };
  async function run(work: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    try {
      await work();
      refresh();
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    saveNoStaff: (teamId: string, draft: NoStaffDraft, ok: string) =>
      run(() => saveFn({ data: { organizationId: orgId, teamId, draft } }), ok),
    removeNoStaff: async (teamId: string, block: NoStaffBlock) => {
      setBusy(true);
      try {
        await removeFn({ data: { organizationId: orgId, teamId, ids: block.ids } });
        refresh();
        toast.success("Removed. Staff are needed that time again.", {
          action: {
            label: "Undo",
            onClick: () =>
              void run(
                () =>
                  saveFn({ data: { organizationId: orgId, teamId, draft: draftFromBlock(block) } }),
                "Undone",
              ),
          },
        });
      } catch (e) {
        toast.error(errText(e));
      } finally {
        setBusy(false);
      }
    },
    // No client names in toasts (PHI).
    addAway: (clientId: string, draft: AwayDraft) =>
      run(() => addAwayFn({ data: { organizationId: orgId, clientId, draft } }), "Away time saved"),
    removeAway: (clientId: string, id: string) =>
      run(
        () => archiveAwayFn({ data: { organizationId: orgId, clientId, id } }),
        "Away time removed",
      ),
  };
}

export type CoverageActions = ReturnType<typeof useCoverageActions>;
