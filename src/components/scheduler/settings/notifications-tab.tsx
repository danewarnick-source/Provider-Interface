// Settings › Notifications (agency defaults; each team member can turn alerts
// down on their phone, not urgent ones) and › Who sees what (read-only: the
// access rules every screen enforces).
import { useServerFn } from "@tanstack/react-start";
import { saveAgencySettings } from "@/lib/scheduler/settings/settings-save.functions";
import { Panel, Segmented, SettingRow, useSettings } from "./settings-controls";

export function NotificationsTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const fn = useServerFn(saveAgencySettings);
  const a = data.agency;
  const set = (patch: Parameters<typeof fn>[0]["data"]["patch"], saved: string) =>
    save(() => fn({ data: { organizationId: orgId, patch } }), saved);
  return (
    <Panel
      title="Notifications"
      sub="Agency defaults. Each team member can turn alerts down further from their phone, but can't turn off urgent ones."
    >
      <SettingRow label="Shift reminder" hint="Push to the person, with who else is on.">
        <Segmented
          label="Shift reminder"
          readOnly={!canEdit}
          value={a.reminder_minutes}
          choices={[
            { value: 60, label: "1 hour before" },
            { value: 120, label: "2 hours" },
            { value: 0, label: "Off" },
          ]}
          onPick={(v) =>
            set(
              { reminder_minutes: v },
              v ? `Shift reminder ${v / 60} h before saved` : "Shift reminders off",
            )
          }
        />
      </SettingRow>
      <SettingRow
        label="Schedule changes"
        hint="Urgent ones (today or tomorrow) always go right away."
      >
        <Segmented
          label="Schedule changes"
          readOnly={!canEdit}
          value={a.digest}
          choices={[
            { value: true, label: "One daily digest" },
            { value: false, label: "Each change" },
          ]}
          onPick={(v) =>
            set(
              { digest: v },
              v ? "Schedule changes: one daily digest" : "Schedule changes: each change",
            )
          }
        />
      </SettingRow>
      <SettingRow label="Location" hint="Checked at clock-in and clock-out only.">
        <Segmented
          label="Location"
          readOnly={!canEdit}
          value={a.location_at_punch_only}
          choices={[
            { value: true, label: "At punches only" },
            { value: false, label: "During the shift" },
          ]}
          onPick={(v) =>
            set(
              { location_at_punch_only: v },
              v ? "Location: at punches only" : "Location: during the shift",
            )
          }
        />
      </SettingRow>
    </Panel>
  );
}

const ACCESS: ReadonlyArray<[string, string, string]> = [
  [
    "Staff cost and wages",
    "Board, home pages, pay settings",
    "Owner, and anyone with Financial reports",
  ],
  [
    "Other people's schedules",
    "Team members see who else is on their own shifts, and the house schedule for homes they're on",
    "Leads and up: their homes",
  ],
  ["Client details", "Only the people assigned to that client", "Assigned team members"],
  [
    "Punch fixes",
    "Own punches: team member. Everyone's: the home's lead and the owner",
    "Lead, Owner",
  ],
];

export function AccessTab() {
  const { data } = useSettings();
  return (
    <Panel title="Who sees what" sub="Enforced on every screen, not just captioned.">
      <ul>
        {[
          ...ACCESS,
          [
            "Hold-over record",
            "Set on Open shifts & hold-overs",
            data.agency.holdover_visible ? "Everyone" : "Leads and owner",
          ] as [string, string, string],
        ].map(([what, where, who]) => (
          <li
            key={what}
            className="flex flex-col gap-1 border-t border-[var(--hive-border)] py-3 first:border-t-0 sm:flex-row sm:justify-between"
          >
            <span className="text-sm">
              {what}
              <span className="block text-xs text-muted-foreground">{where}</span>
            </span>
            <b className="text-sm">{who}</b>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
