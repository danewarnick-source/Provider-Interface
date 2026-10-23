// The Scheduling settings screen (Office › Settings, /dashboard/scheduler/settings).
// Loads everything once (loadSchedulingSettings), shows the eight tabs with the
// current one in the URL, and a read-only notice for agency-wide Admins.
import { differenceCount } from "@/lib/scheduler/settings/settings-model";
import { useSchedulingSettings } from "./use-scheduling-settings";
import { ApprovalsTab } from "./approvals-tab";
import { NewHiresTab } from "./new-hires-tab";
import { AccessTab, NotificationsTab } from "./notifications-tab";
import { OpenShiftsTab } from "./open-shifts-tab";
import { PayTab } from "./pay-tab";
import { RulesTab } from "./rules-tab";
import { SettingsProvider } from "./settings-controls";
import { READ_ONLY_REASON } from "./settings-format";
import { ShiftTypesTab } from "./shift-types-tab";

export const SETTINGS_TABS = [
  ["types", "Shift types", ShiftTypesTab],
  ["rules", "Rules", RulesTab],
  ["pay", "Pay", PayTab],
  ["open", "Open shifts & hold-overs", OpenShiftsTab],
  ["approvals", "Approvals", ApprovalsTab],
  ["newhires", "New hires", NewHiresTab],
  ["notify", "Notifications", NotificationsTab],
  ["access", "Who sees what", AccessTab],
] as const;
export type SettingsTabKey = (typeof SETTINGS_TABS)[number][0];

export function SchedulingSettingsPage({
  tab,
  onTab,
}: {
  tab: SettingsTabKey;
  onTab: (t: SettingsTabKey) => void;
}) {
  const { orgId, data, isLoading, error } = useSchedulingSettings();
  if (isLoading || !orgId)
    return <div className="p-8 text-sm text-muted-foreground">Loading settings…</div>;
  if (error || !data)
    return (
      <div role="alert" className="p-8 text-sm">
        {error instanceof Error
          ? error.message
          : "Scheduling settings didn't load. Reload the page."}
      </div>
    );
  const n = differenceCount(data.agency, data.homeSettings);
  const Current = SETTINGS_TABS.find(([k]) => k === tab)?.[2] ?? RulesTab;
  return (
    <SettingsProvider orgId={orgId} data={data}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        <div>
          <h1 className="text-xl font-semibold">Scheduling settings</h1>
          <p className="text-sm text-muted-foreground">
            Agency defaults first. Any home or program can be set differently, and each home's page
            lists what's different there. {n} place-specific setting{n === 1 ? "" : "s"} today.
          </p>
        </div>
        {!data.canEdit && (
          <div
            role="note"
            className="rounded-lg border border-[var(--hive-border)] bg-[var(--hive-muted-surface)] px-3 py-2 text-sm"
          >
            {READ_ONLY_REASON} You can see them here.
          </div>
        )}
        <nav
          aria-label="Settings sections"
          className="flex flex-wrap gap-1 border-b border-[var(--hive-border)]"
        >
          {SETTINGS_TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-current={k === tab ? "page" : undefined}
              onClick={() => onTab(k)}
              className={`min-h-11 px-3 text-sm font-semibold ${k === tab ? "border-b-2 border-[var(--hive-gold)]" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <Current />
      </div>
    </SettingsProvider>
  );
}
