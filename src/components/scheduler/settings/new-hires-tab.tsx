// Settings › New hires (Decision 8): a team member works paired shifts at a
// home until the Evidence items that block working alone are on file and a
// lead (or the owner) signs them off there. The signer is the person who
// clicks; undoing asks for a reason. The engine's "New hire working alone"
// rule reads new_hire_signoffs.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { endSignOff, signOffNewHire } from "@/lib/scheduler/settings/new-hire-signoffs.functions";
import { setShiftTypeCoverage } from "@/lib/scheduler/settings/shift-types.functions";
import { Panel, Segmented, SettingRow, Tag, useSettings } from "./settings-controls";
import { READ_ONLY_REASON } from "./settings-format";
import { ReasonDialog } from "./reason-dialog";

export function NewHiresTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const signFn = useServerFn(signOffNewHire);
  const endFn = useServerFn(endSignOff);
  const coverageFn = useServerFn(setShiftTypeCoverage);
  const [undo, setUndo] = useState<{ id: string; who: string; home: string } | null>(null);
  const paired = data.shiftTypes.find((t) => t.key === "paired");
  const homeName = (id: string) => data.homes.find((h) => h.id === id)?.name ?? "this home";
  return (
    <Panel
      title="New hires"
      sub="New hires work paired shifts until the Evidence items that block working alone are on file, then a lead signs them off for each home. The sign-off is saved with the name of the person who signed."
    >
      {paired && (
        <SettingRow
          label="Paired shifts count toward coverage"
          hint="If no, a paired new hire is an extra set of hands and someone else must cover the home."
        >
          <Segmented
            label="Paired shifts count toward coverage"
            readOnly={!canEdit}
            value={paired.counts_toward_coverage}
            choices={[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ]}
            onPick={(v) =>
              save(
                () => coverageFn({ data: { organizationId: orgId, typeId: paired.id, counts: v } }),
                `Paired shifts ${v ? "count" : "don't count"} toward coverage`,
              )
            }
          />
        </SettingRow>
      )}
      {data.newHires.length === 0 && (
        <p className="py-3 text-sm text-muted-foreground">
          Nobody is on a home's team yet. Add team members to a home's clients in Team members.
        </p>
      )}
      {data.newHires.map((n) => {
        const ready = n.orientationOnFile && n.personTrainingOnFile;
        const home = homeName(n.teamId);
        return (
          <div
            key={`${n.staffId}|${n.teamId}`}
            className="mt-3 rounded-lg border border-[var(--hive-border)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-sm">
                {n.staffName} · {home}
              </b>
              {n.signoff ? (
                <Tag tone="ok">Cleared to work alone</Tag>
              ) : (
                <Tag tone="profile">Paired shifts only</Tag>
              )}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                {n.orientationOnFile ? "✓" : "✗"} 30-day orientation{" "}
                {n.orientationOnFile ? "on file in Evidence" : "not on file"}
              </li>
              <li>
                {n.personTrainingOnFile ? "✓" : "✗"} Person-specific training for {home}{" "}
                {n.personTrainingOnFile ? "on file" : "not on file"}
              </li>
              <li>
                {n.signoff
                  ? `✓ Signed off by ${n.signoff.signedBy} on ${formatDate(n.signoff.signedAt.slice(0, 10))}`
                  : "Waiting on a sign-off"}
              </li>
            </ul>
            <div className="mt-2">
              {n.signoff ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={!canEdit}
                  title={canEdit ? undefined : READ_ONLY_REASON}
                  onClick={() => setUndo({ id: n.signoff!.id, who: n.staffName, home })}
                >
                  Undo sign-off
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="min-h-11"
                    disabled={!canEdit || !ready}
                    title={
                      !canEdit
                        ? READ_ONLY_REASON
                        : ready
                          ? undefined
                          : "Orientation and person-specific training must be on file first"
                    }
                    onClick={() =>
                      save(
                        () =>
                          signFn({
                            data: { organizationId: orgId, staffId: n.staffId, teamId: n.teamId },
                          }),
                        `${n.staffName} can work alone at ${home}. Open shifts there now go to them too.`,
                      )
                    }
                  >
                    Sign off to work alone
                  </Button>
                  {canEdit && !ready && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Orientation and person-specific training must be on file in Evidence first.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      <ReasonDialog
        open={!!undo}
        title={`Undo ${undo?.who}'s sign-off at ${undo?.home}?`}
        body="They go back to paired shifts at this home until someone signs them off again. Shifts already on the schedule stay; new ones need a paired shift."
        action="Undo sign-off"
        onCancel={() => setUndo(null)}
        onConfirm={(reason) =>
          save(
            () => endFn({ data: { organizationId: orgId, signoffId: undo!.id, reason } }),
            "Sign-off removed",
          )
        }
      />
    </Panel>
  );
}
