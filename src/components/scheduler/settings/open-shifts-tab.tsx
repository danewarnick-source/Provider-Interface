// Settings › Open shifts & hold-overs (Decisions 6, 7): who gets an open shift
// (agency default and per home), quiet hours, the urgent window, the
// escalation waits, and the hold-over ask. claimOpenShift reads the pickup
// mode through settings/pickup.ts.
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PICKUP_LABEL, pickupModeFor, type PickupMode } from "@/lib/scheduler/settings/pickup";
import {
  saveAgencySettings,
  saveHomeSettings,
} from "@/lib/scheduler/settings/settings-save.functions";
import { Panel, Segmented, SettingRow, useSettings } from "./settings-controls";
import { hourLabel } from "./settings-format";

const STEPS = [
  { who: "Home lead", hint: "The lead for that home gets a call-style push" },
  { who: "On-call", hint: "Whoever is on-call that day" },
  { who: "Owner", hint: "The owner" },
];

export function OpenShiftsTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const agencyFn = useServerFn(saveAgencySettings);
  const homeFn = useServerFn(saveHomeSettings);
  const a = data.agency;
  const setAgency = (patch: Parameters<typeof agencyFn>[0]["data"]["patch"], saved: string) =>
    save(() => agencyFn({ data: { organizationId: orgId, patch } }), saved);
  const quiet = (key: "quiet_start" | "quiet_end", hours: number[]) => (
    <select
      className="min-h-11 rounded-md border px-2"
      aria-label={key === "quiet_start" ? "Quiet hours start" : "Quiet hours end"}
      disabled={!canEdit}
      value={a[key]}
      onChange={(e) =>
        setAgency(
          { [key]: Number(e.target.value) },
          `Quiet hours ${key === "quiet_start" ? "start" : "end"} ${hourLabel(Number(e.target.value))} saved`,
        )
      }
    >
      {hours.map((h) => (
        <option key={h} value={h}>
          {hourLabel(h)}
        </option>
      ))}
    </select>
  );
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Offering open shifts"
        sub="Open shifts go to everyone qualified at once: on the team, trained, cards current, not off, not already working, and under the agency cap."
      >
        <SettingRow label="Who gets it" hint="Agency default. A home can be different below.">
          <Segmented
            label="Who gets it"
            readOnly={!canEdit}
            value={a.claim_mode}
            choices={[
              { value: "first", label: "First to claim" },
              { value: "approve", label: "Approver picks" },
            ]}
            onPick={(v) =>
              setAgency(
                { claim_mode: v as "first" | "approve" },
                `Open shifts: ${v === "first" ? "first to claim" : "an approver picks"} saved`,
              )
            }
          />
        </SettingRow>
        {data.homes.map((h) => {
          const own = data.homeSettings.find((s) => s.team_id === h.id)?.pickup_approval ?? null;
          const mode = pickupModeFor(a.claim_mode, own);
          return (
            <SettingRow
              key={h.id}
              label={h.name}
              hint={
                own
                  ? `Pickups: ${PICKUP_LABEL[mode]}`
                  : `Pickups: ${PICKUP_LABEL[mode]} (agency default)`
              }
            >
              <Segmented
                label={`${h.name} pickups`}
                readOnly={!canEdit}
                value={own ? mode : null}
                choices={(Object.keys(PICKUP_LABEL) as PickupMode[]).map((m) => ({
                  value: m,
                  label: PICKUP_LABEL[m],
                }))}
                onPick={(v) =>
                  save(
                    () =>
                      homeFn({
                        data: {
                          organizationId: orgId,
                          teamId: h.id,
                          patch: { pickup_approval: v },
                        },
                      }),
                    `${h.name} pickups: ${PICKUP_LABEL[v as PickupMode]} saved`,
                  )
                }
              />
              {own && canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    save(
                      () =>
                        homeFn({
                          data: {
                            organizationId: orgId,
                            teamId: h.id,
                            patch: { pickup_approval: null },
                          },
                        }),
                      `${h.name} pickups now use the agency default`,
                    )
                  }
                >
                  Use agency default
                </Button>
              )}
            </SettingRow>
          );
        })}
        <SettingRow
          label="Quiet hours"
          hint="No offers in this window unless the shift starts soon."
        >
          {quiet("quiet_start", [20, 21, 22])}
          <span className="text-xs">to</span>
          {quiet("quiet_end", [6, 7, 8])}
        </SettingRow>
        <SettingRow
          label="Urgent means it starts within"
          hint="Urgent offers ignore quiet hours and go as a push."
        >
          <Segmented
            label="Urgent window"
            readOnly={!canEdit}
            value={a.urgent_hours}
            choices={[2, 4, 8].map((v) => ({ value: v, label: `${v} h` }))}
            onPick={(v) => setAgency({ urgent_hours: v }, `Urgent window ${v} h saved`)}
          />
        </SettingRow>
      </Panel>

      <Panel
        title="When nobody picks it up"
        sub="If a home would be left without staff, the platform works down this list. Each step waits before moving on."
      >
        {STEPS.map((step, i) => (
          <SettingRow key={step.who} label={`${i + 1}. ${step.who}`} hint={step.hint}>
            <Segmented
              label={`${step.who} wait`}
              readOnly={!canEdit}
              value={a.escalation_waits[i] ?? 15}
              choices={[5, 15, 30].map((v) => ({ value: v, label: `${v} min` }))}
              onPick={(v) =>
                setAgency(
                  { escalation_waits: a.escalation_waits.map((w, j) => (j === i ? v : w)) },
                  `${step.who} wait ${v} min saved`,
                )
              }
            />
          </SettingRow>
        ))}
        <SettingRow
          label={`${STEPS.length + 1}. Ask someone on shift to stay`}
          hint={`The person there who was held over longest ago is asked first. They can say no; the next person is asked. Never past the hours-in-a-row rule (${a.max_hours_in_row} h).`}
        >
          <Segmented
            label="Ask someone on shift to stay"
            readOnly={!canEdit}
            value={a.holdover_ask}
            choices={[
              { value: true, label: "On" },
              { value: false, label: "Off" },
            ]}
            onPick={(v) =>
              setAgency({ holdover_ask: v }, `Ask someone to stay ${v ? "on" : "off"}`)
            }
          />
        </SettingRow>
      </Panel>

      <Panel
        title="Hold-over record"
        sub="Who stayed past their shift because no one else could come. Top of the list is asked first next time."
        action={
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Staff can see this list
            <Segmented
              label="Staff can see the hold-over list"
              readOnly={!canEdit}
              value={a.holdover_visible}
              choices={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              onPick={(v) =>
                setAgency(
                  { holdover_visible: v },
                  `Hold-over list ${v ? "visible to staff" : "hidden from staff"}`,
                )
              }
            />
          </span>
        }
      >
        <p className="py-3 text-sm text-muted-foreground">
          No hold-overs recorded yet. Each one is listed here with its reason once it happens.
        </p>
      </Panel>
    </div>
  );
}
