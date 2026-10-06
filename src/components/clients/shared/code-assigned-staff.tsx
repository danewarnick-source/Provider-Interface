// Per-code staff assignment control. Shows who is currently assigned to
// work a given authorized service code for a client, plus a "+ Add staff"
// popover to assign/swap staff right there — no navigation. Adding a staff
// member pre-checks all of the client's authorized codes (with "Select all");
// the explicit list is saved through setStaffClientCodes — the same single
// write path as CaseloadEditor and Team Members — so a change here shows up
// immediately on the client's Caseload editor and the staff member's own
// assignment list. A newly authorized code adds nobody automatically.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, UserPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import { normalizeServiceCode, withCodeAdded, withCodeRemoved } from "@/lib/assignment-codes";
import { useCurrentOrg } from "@/hooks/use-org";
import {
  clientCodeAssignmentsQueryKey,
  useClientCodeAssignments,
} from "@/hooks/use-client-code-assignments";

function invalidateAssignmentQueries(qc: ReturnType<typeof useQueryClient>, clientId: string) {
  qc.invalidateQueries({ queryKey: clientCodeAssignmentsQueryKey(clientId) });
  qc.invalidateQueries({ queryKey: ["caseload-editor-current-v2"] });
  qc.invalidateQueries({ queryKey: ["caseload"] });
  qc.invalidateQueries({ queryKey: ["my-assignments"] });
  qc.invalidateQueries({ queryKey: ["client-care-data"] });
  qc.invalidateQueries({ queryKey: ["scheduler-data"] });
}

export function CodeAssignedStaff({ clientId, code }: { clientId: string; code: string }) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const { staffForCode, unassignedForCode, codesForStaff, authorizedCodes, isLoading } =
    useClientCodeAssignments(clientId);
  const thisCode = normalizeServiceCode(code);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // Codes to assign to the picked staff. Pre-checks every authorized code;
  // this row's code is always included.
  const [pickedCodes, setPickedCodes] = useState<string[]>([]);

  const saveFn = useServerFn(setStaffClientCodes);

  function openPicker(o: boolean) {
    setOpen(o);
    if (o) setPickedCodes([...authorizedCodes]);
    else setPicked([]);
  }

  function togglePickedCode(c: string) {
    if (c === thisCode) return;
    const next = new Set(pickedCodes);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setPickedCodes(authorizedCodes.filter((x) => next.has(x)));
  }

  const addM = useMutation({
    mutationFn: async (staffIds: string[]) => {
      const toAssign = withCodeAdded(pickedCodes, thisCode);
      for (const staffId of staffIds) {
        await saveFn({
          data: {
            organizationId: org!.organization_id,
            staffId,
            clientId,
            codes: withCodeAdded([...codesForStaff(staffId), ...toAssign], thisCode),
          },
        });
      }
    },
    onSuccess: (_result, staffIds) => {
      invalidateAssignmentQueries(qc, clientId);
      toast.success(
        `Added ${staffIds.length} staff member${staffIds.length === 1 ? "" : "s"} to ${code}`,
      );
      setPicked([]);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    // Removing the last code deletes the assignment (server side).
    mutationFn: (staffId: string) =>
      saveFn({
        data: {
          organizationId: org!.organization_id,
          staffId,
          clientId,
          codes: withCodeRemoved(codesForStaff(staffId), thisCode),
        },
      }),
    onSuccess: () => {
      invalidateAssignmentQueries(qc, clientId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assigned = staffForCode(code);
  const candidates = unassignedForCode(code);
  const candidateOptions = candidates.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isLoading ? (
        <span className="text-xs text-muted-foreground">Loading…</span>
      ) : assigned.length === 0 ? (
        <span className="text-xs text-amber-700 dark:text-amber-400">
          No staff assigned to {code} yet
        </span>
      ) : (
        assigned.map((s) => (
          <Badge key={s.id} variant="secondary" className="gap-1 pr-1 text-[11px]">
            {s.name}
            <button
              type="button"
              aria-label={`Unassign ${s.name} from ${code}`}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              disabled={removeM.isPending}
              onClick={() => removeM.mutate(s.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))
      )}
      <Popover open={open} onOpenChange={openPicker}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            disabled={!org?.organization_id}
          >
            <Plus className="h-3 w-3" /> Add staff
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium">
            <UserPlus className="h-3.5 w-3.5" /> Assign staff to {code}
          </div>
          {candidates.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              All active staff are already assigned to this code.
            </div>
          ) : (
            <>
              <CheckboxMultiSelect
                value={picked}
                onChange={setPicked}
                options={candidateOptions}
                placeholder="Pick staff…"
                searchPlaceholder="Filter staff…"
                emptyLabel="No matches"
              />
              <div className="mt-2 rounded border p-1.5">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] font-medium">Codes to assign</span>
                  <button
                    type="button"
                    className="text-[11px] underline disabled:opacity-50 disabled:no-underline"
                    disabled={pickedCodes.length === authorizedCodes.length}
                    onClick={() => setPickedCodes([...authorizedCodes])}
                  >
                    Select all
                  </button>
                </div>
                {authorizedCodes.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={c === thisCode || pickedCodes.includes(c)}
                      disabled={c === thisCode}
                      onCheckedChange={() => togglePickedCode(c)}
                    />
                    <span className="font-mono">{c}</span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full"
                disabled={picked.length === 0 || addM.isPending}
                onClick={() => addM.mutate(picked)}
              >
                {addM.isPending ? "Adding…" : `Add${picked.length ? ` ${picked.length}` : ""}`}
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
