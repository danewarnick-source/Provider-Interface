// Settings › Approvals: each home's lead (teams.manager_id, who also reviews
// its notes) and who approves swaps, time off, punch fixes and publishing.
// The owner can always approve anything. Pickups are on the Open shifts tab.
import { useServerFn } from "@tanstack/react-start";
import {
  APPROVAL_DEFAULTS,
  APPROVAL_LABEL,
  APPROVER_LABEL,
  type ApprovalKind,
  type Approver,
} from "@/lib/scheduler/settings/settings-model";
import { saveHomeSettings, setHomeLead } from "@/lib/scheduler/settings/settings-save.functions";
import { Panel, useSettings } from "./settings-controls";
import { READ_ONLY_REASON } from "./settings-format";

const KINDS = Object.keys(APPROVAL_DEFAULTS) as ApprovalKind[];
const select = "min-h-11 w-full rounded-md border px-2 text-sm";

export function ApprovalsTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const homeFn = useServerFn(saveHomeSettings);
  const leadFn = useServerFn(setHomeLead);
  const nameOf = (id: string | null) => data.people.find((p) => p.id === id)?.name ?? "No lead";
  if (data.homes.length === 0) {
    return (
      <Panel title="Approvals, per home and program">
        <p className="py-3 text-sm text-muted-foreground">
          No homes or programs yet. Add one in Homes to name its lead.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Approvals, per home and program"
      sub="Each place names its lead and who approves what. The owner can always approve anything. Leads only see the homes they lead. Pickups are set on the Open shifts tab."
    >
      {data.homes.map((h) => {
        const own = data.homeSettings.find((s) => s.team_id === h.id);
        return (
          <div
            key={h.id}
            className="grid gap-2 border-t border-[var(--hive-border)] py-3 first:border-t-0 sm:grid-cols-6 sm:items-center"
          >
            <b className="text-sm">{h.name}</b>
            <label className="text-xs text-muted-foreground">
              Lead
              <select
                className={select}
                aria-label={`${h.name} lead`}
                disabled={!canEdit}
                title={canEdit ? undefined : READ_ONLY_REASON}
                value={h.managerId ?? ""}
                onChange={(e) =>
                  save(
                    () =>
                      leadFn({
                        data: {
                          organizationId: orgId,
                          teamId: h.id,
                          leadId: e.target.value || null,
                        },
                      }),
                    `${h.name} lead: ${nameOf(e.target.value || null)} saved`,
                  )
                }
              >
                <option value="">No lead</option>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {KINDS.map((k) => {
              const v =
                (own?.[`${k}_approval` as const] as Approver | null | undefined) ??
                APPROVAL_DEFAULTS[k];
              return (
                <label key={k} className="text-xs text-muted-foreground">
                  {APPROVAL_LABEL[k]}
                  <select
                    className={select}
                    aria-label={`${h.name} ${APPROVAL_LABEL[k]}`}
                    disabled={!canEdit}
                    title={canEdit ? undefined : READ_ONLY_REASON}
                    value={v}
                    onChange={(e) => {
                      const next = e.target.value as Approver;
                      save(
                        () =>
                          homeFn({
                            data: {
                              organizationId: orgId,
                              teamId: h.id,
                              patch: {
                                [`${k}_approval`]: next === APPROVAL_DEFAULTS[k] ? null : next,
                              },
                            },
                          }),
                        `${h.name} ${APPROVAL_LABEL[k].toLowerCase()}: ${APPROVER_LABEL[next]} saved`,
                      );
                    }}
                  >
                    {(Object.keys(APPROVER_LABEL) as Approver[]).map((o) => (
                      <option key={o} value={o}>
                        {APPROVER_LABEL[o]}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        );
      })}
    </Panel>
  );
}
