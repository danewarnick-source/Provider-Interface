// Admin Nectar's AI settings tab (N6, Decision 10, as in the demo): Nectar on
// for the agency, and each AI feature with one line on what it does. Changes
// need Edit on Agency settings; the server checks it too.

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AI_SETTINGS_NOTE,
  applySettingsPatch,
  featureToggles,
  NECTAR_ON_HELP,
  nectarOnLabel,
} from "@/lib/nectar/engine/settings";
import { AdminError, AdminLoading } from "./admin-states";
import { useNectarSettings, useSaveNectarSettings } from "./use-nectar-admin";

export function SettingsTab({
  orgId,
  agencyName,
  canEdit,
}: {
  orgId: string;
  agencyName: string | null;
  canEdit: boolean;
}) {
  const q = useNectarSettings(orgId);
  const save = useSaveNectarSettings(orgId);
  if (q.isLoading) return <AdminLoading />;
  if (q.error || !q.data) return <AdminError error={q.error} />;
  // While a change saves, show it already made.
  const settings = save.isPending ? applySettingsPatch(q.data, save.variables ?? {}) : q.data;
  const locked = !canEdit || save.isPending;
  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <SettingRow
        id="nectar-setting-enabled"
        label={nectarOnLabel(agencyName)}
        help={NECTAR_ON_HELP}
        checked={settings.enabled}
        disabled={locked}
        onChange={(on) => save.mutate({ enabled: on })}
      />
      <div className="space-y-4 pl-6">
        {featureToggles(settings).map((f) => (
          <SettingRow
            key={f.key}
            id={`nectar-setting-${f.key}`}
            label={f.label}
            help={f.help}
            checked={f.on}
            disabled={locked || f.disabled}
            onChange={(on) => save.mutate({ [f.key]: on })}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{AI_SETTINGS_NOTE}</p>
      {!canEdit ? (
        <p className="text-xs font-semibold text-muted-foreground">
          You can see these settings but not change them. Changing them needs Edit on Agency
          settings.
        </p>
      ) : null}
    </div>
  );
}

function SettingRow({
  id,
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5 h-5 w-5"
      />
      <Label htmlFor={id} className="cursor-pointer space-y-0.5 font-normal leading-snug">
        <span className="block font-semibold text-[var(--hive-text)]">{label}</span>
        <span className="block text-sm text-muted-foreground">{help}</span>
      </Label>
    </div>
  );
}
