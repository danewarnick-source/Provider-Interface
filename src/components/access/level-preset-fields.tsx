// Access level + preset pickers shared by Add employee and the Access & presets invite form.
// Owner is only offered to Owners; the server enforces the same rule.

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { ACCESS_LEVELS, LEVEL_LABEL, LEVEL_SUMMARY, type AccessLevel } from "@/lib/access/levels";
import { usePresets } from "./queries";

export type LevelPresetValue = { level: AccessLevel; presetId: string | null };

export function LevelPresetFields({
  orgId,
  value,
  onChange,
  idPrefix,
}: {
  orgId: string | undefined;
  value: LevelPresetValue;
  onChange: (next: LevelPresetValue) => void;
  idPrefix: string;
}) {
  const { isOwner } = useAccess();
  const presets = usePresets(orgId).data ?? [];
  const levels = isOwner ? ACCESS_LEVELS : ACCESS_LEVELS.filter((l) => l === "staff");
  const forLevel = presets.filter((p) => p.access_level === value.level);
  const defaultFor = (level: AccessLevel) =>
    presets.find((p) => p.access_level === level && (p.seed_key === "dsp" || p.seed_key === "program_manager"))?.id ??
    presets.find((p) => p.access_level === level)?.id ??
    null;

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-level`}>Access level</Label>
        <Select
          value={value.level}
          onValueChange={(v) => {
            const level = v as AccessLevel;
            onChange({ level, presetId: level === "owner" ? null : defaultFor(level) });
          }}
        >
          <SelectTrigger id={`${idPrefix}-level`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{LEVEL_SUMMARY[value.level]}</p>
      </div>
      {value.level !== "owner" && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-preset`}>Preset</Label>
          <Select
            value={value.presetId ?? defaultFor(value.level) ?? ""}
            onValueChange={(presetId) => onChange({ ...value, presetId })}
          >
            <SelectTrigger id={`${idPrefix}-preset`}><SelectValue placeholder="Default preset" /></SelectTrigger>
            <SelectContent>
              {forLevel.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}
