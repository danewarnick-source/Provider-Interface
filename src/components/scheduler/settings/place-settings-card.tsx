// "Settings for <home>" on a home's page: only what this home does differently
// from the agency defaults (homeDifferences), with a link to change it in
// Scheduling settings. Shown to the Owner and agency-wide Admins only, as is
// the scheduler toolbar's Scheduling settings link.
import { Link } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { homeDifferences } from "@/lib/scheduler/settings/settings-model";
import { useSchedulingSettings } from "./use-scheduling-settings";
import { Panel } from "./settings-controls";

/** The scheduler toolbar's way into Settings, for the Owner and agency-wide Admins. */
export function SchedulingSettingsLink() {
  const access = useAccess();
  if (!access.isOwner && !access.isAgencyAdmin) return null;
  return (
    <Link
      to="/dashboard/scheduler/settings"
      search={{ tab: "rules" }}
      className="inline-flex min-h-11 items-center rounded-md border border-[var(--hive-border)] px-3.5 text-[13px] font-semibold text-[var(--hive-text)]"
    >
      Scheduling settings
    </Link>
  );
}

export function PlaceSettingsCard({ teamId, name }: { teamId: string; name: string }) {
  const access = useAccess();
  const allowed = access.isOwner || access.isAgencyAdmin;
  if (!allowed) return null;
  return <PlaceSettings teamId={teamId} name={name} />;
}

function PlaceSettings({ teamId, name }: { teamId: string; name: string }) {
  const { data } = useSchedulingSettings();
  if (!data) return null;
  const rows = homeDifferences(
    data.agency,
    data.homeSettings.find((h) => h.team_id === teamId) ?? null,
  );
  return (
    <Panel
      title={`Settings for ${name}`}
      sub="Only what's different from the agency defaults."
      action={
        <Link
          to="/dashboard/scheduler/settings"
          search={{ tab: "rules" }}
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--hive-border)] px-3 text-sm font-semibold"
        >
          Change in Settings
        </Link>
      }
    >
      <ul data-testid="place-settings">
        {rows.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">Same as the agency defaults.</li>
        )}
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex justify-between gap-3 border-t border-[var(--hive-border)] py-2 text-sm first:border-t-0"
          >
            <span>{r.label}</span>
            <b>{r.value}</b>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
