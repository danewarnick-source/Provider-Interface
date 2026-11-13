// Settings › Pay: overtime week and rate, overnight pay per home, sleep rate,
// on-call stipend, night and weekend differentials, per-home premiums and
// holidays. Stored now; B3's owner-only cost view reads them.
import { useServerFn } from "@tanstack/react-start";
import { formatDate } from "@/lib/clients/dates";
import {
  money,
  overnightLine,
  OVERNIGHT_LABEL,
  type OvernightPay,
} from "@/lib/scheduler/settings/settings-model";
import {
  saveAgencySettings,
  saveHomeSettings,
  setHolidayPay,
} from "@/lib/scheduler/settings/settings-save.functions";
import { Panel, Segmented, SettingRow, useSettings } from "./settings-controls";
import { hourLabel } from "./settings-format";

const OFF = { value: null, label: "Off" } as const;

export function PayTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const agencyFn = useServerFn(saveAgencySettings);
  const homeFn = useServerFn(saveHomeSettings);
  const holidayFn = useServerFn(setHolidayPay);
  const a = data.agency;
  const setAgency = (patch: Parameters<typeof agencyFn>[0]["data"]["patch"], saved: string) =>
    save(() => agencyFn({ data: { organizationId: orgId, patch } }), saved);
  const setHome = (
    teamId: string,
    patch: Parameters<typeof homeFn>[0]["data"]["patch"],
    saved: string,
  ) => save(() => homeFn({ data: { organizationId: orgId, teamId, patch } }), saved);
  const homeRow = (id: string) => data.homeSettings.find((h) => h.team_id === id);
  const homes = data.homes.filter((h) => h.kind === "rhs_home");
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Overtime" sub="Used for the cost owners see and payroll later.">
        <SettingRow
          label="Workweek starts"
          hint="Overtime is counted per workweek, not per pay period."
        >
          <Segmented
            label="Workweek starts"
            readOnly={!canEdit}
            value={a.workweek_start}
            choices={[
              { value: 0, label: "Sun" },
              { value: 1, label: "Mon" },
            ]}
            onPick={(v) =>
              setAgency(
                { workweek_start: v as 0 | 1 },
                `Workweek starts ${v ? "Monday" : "Sunday"} saved`,
              )
            }
          />
        </SettingRow>
        <SettingRow
          label="Overtime pay"
          hint={`Overtime starts after ${a.ot_threshold_hours} h a week (set on the Rules tab).`}
        >
          <Segmented
            label="Overtime pay"
            readOnly={!canEdit}
            value={Number(a.ot_multiplier)}
            choices={[1.5, 2].map((m) => ({ value: m, label: `${m}×` }))}
            onPick={(v) => setAgency({ ot_multiplier: v }, `Overtime pay ${v}× saved`)}
          />
        </SettingRow>
      </Panel>

      <Panel
        title="Overnight pay, per home"
        sub="Awake time logged during an asleep night always pays the normal rate. Excluding sleep time is only allowed on shifts of 24 hours or more."
      >
        {homes.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            No staffed homes yet. Add one in Homes, then set its overnight pay here.
          </p>
        )}
        {homes.map((h) => {
          const pay = (homeRow(h.id)?.overnight_pay ?? "every") as OvernightPay;
          return (
            <SettingRow key={h.id} label={h.name} hint={overnightLine(pay, Number(a.sleep_rate))}>
              <Segmented
                label={`${h.name} overnight pay`}
                readOnly={!canEdit}
                value={pay}
                choices={(Object.keys(OVERNIGHT_LABEL) as OvernightPay[]).map((k) => ({
                  value: k,
                  label: OVERNIGHT_LABEL[k],
                }))}
                onPick={(v) =>
                  setHome(
                    h.id,
                    { overnight_pay: v === "every" ? null : v },
                    `${h.name} overnight pay: ${OVERNIGHT_LABEL[v]} saved`,
                  )
                }
              />
            </SettingRow>
          );
        })}
        <SettingRow label="Sleep rate" hint="Asleep hours at homes that pay a sleep rate.">
          <Segmented
            label="Sleep rate"
            readOnly={!canEdit}
            value={Number(a.sleep_rate)}
            choices={[10, 12, 14].map((v) => ({ value: v, label: `${money(v)}/h` }))}
            onPick={(v) => setAgency({ sleep_rate: v }, `Sleep rate ${money(v)}/h saved`)}
          />
        </SettingRow>
        <SettingRow label="On-call stipend" hint="Flat amount for an on-call shift.">
          <Segmented
            label="On-call stipend"
            readOnly={!canEdit}
            value={Number(a.oncall_stipend)}
            choices={[25, 40, 60].map((v) => ({ value: v, label: money(v) }))}
            onPick={(v) => setAgency({ oncall_stipend: v }, `On-call stipend ${money(v)} saved`)}
          />
        </SettingRow>
      </Panel>

      <Panel title="Differentials">
        <SettingRow
          label="Night differential"
          hint={`${hourLabel(a.night_from)}–${hourLabel(a.night_to)}`}
        >
          <Segmented
            label="Night differential"
            readOnly={!canEdit}
            value={a.night_diff == null ? null : Number(a.night_diff)}
            choices={[OFF, ...[0.5, 1, 1.5].map((v) => ({ value: v, label: `+${money(v)}/h` }))]}
            onPick={(v) =>
              setAgency(
                { night_diff: v },
                v ? `Night differential +${money(v)}/h saved` : "Night differential off",
              )
            }
          />
        </SettingRow>
        <SettingRow label="Weekend differential" hint="Saturday and Sunday">
          <Segmented
            label="Weekend differential"
            readOnly={!canEdit}
            value={a.weekend_diff == null ? null : Number(a.weekend_diff)}
            choices={[OFF, ...[0.5, 1].map((v) => ({ value: v, label: `+${money(v)}/h` }))]}
            onPick={(v) =>
              setAgency(
                { weekend_diff: v },
                v ? `Weekend differential +${money(v)}/h saved` : "Weekend differential off",
              )
            }
          />
        </SettingRow>
        <h3 className="mt-3 text-sm font-semibold">Premiums for a home or program</h3>
        <p className="text-xs text-muted-foreground">
          Extra per hour for hard-to-staff places. Shows on the open-shift card so staff see it.
        </p>
        {data.homes.map((h) => {
          const p = homeRow(h.id)?.premium_per_hour ?? null;
          return (
            <SettingRow key={h.id} label={h.name}>
              <Segmented
                label={`${h.name} premium`}
                readOnly={!canEdit}
                value={p == null ? null : Number(p)}
                choices={[
                  { value: null, label: "None" },
                  ...[1, 1.5, 2].map((v) => ({ value: v, label: `+${money(v)}` })),
                ]}
                onPick={(v) =>
                  setHome(
                    h.id,
                    { premium_per_hour: v },
                    v ? `${h.name} premium +${money(v)}/h saved` : `${h.name} premium removed`,
                  )
                }
              />
            </SettingRow>
          );
        })}
      </Panel>

      <Panel title="Holidays" sub="Pick your agency's paid holidays and the rate.">
        {data.holidays.map((h) => (
          <SettingRow key={h.id} label={h.name} hint={formatDate(h.holiday_date)}>
            <Segmented
              label={`${h.name} pay`}
              readOnly={!canEdit}
              value={h.pay_multiplier == null ? null : Number(h.pay_multiplier)}
              choices={[
                { value: null, label: "Not paid extra" },
                ...[1.5, 2].map((m) => ({ value: m, label: `${m}×` })),
              ]}
              onPick={(v) =>
                save(
                  () =>
                    holidayFn({ data: { organizationId: orgId, holidayId: h.id, multiplier: v } }),
                  `${h.name}: ${v ? `${v}×` : "not paid extra"} saved`,
                )
              }
            />
          </SettingRow>
        ))}
      </Panel>
    </div>
  );
}
