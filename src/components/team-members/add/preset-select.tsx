// Access dropdown for Add / Import team members: the agency's own access_presets,
// grouped Owner / Admin presets / Team member presets. Owner and Admin only show
// for an Owner (the server enforces the same). The level comes from the preset.

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { usePresets } from "@/components/access/queries";
import { presetGroups, type AccessChoice, type PresetPick } from "@/lib/team-members/add-member";

/** The agency's presets as PresetPicks, plus the viewer's Owner flag. */
export function useAgencyPresets(organizationId: string | null) {
  const { isOwner } = useAccess();
  const q = usePresets(organizationId ?? undefined);
  const presets = useMemo(
    () =>
      (q.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        access_level: p.access_level,
        seed_key: p.seed_key,
      })) as Array<PresetPick & { seed_key: string | null }>,
    [q.data],
  );
  return { presets, isOwner, loading: q.isLoading };
}

export function PresetSelect({
  id,
  value,
  onChange,
  presets,
  isOwner,
  invalid,
  className,
  includeOwner = true,
  placeholder = "Choose access",
}: {
  id?: string;
  value: AccessChoice | "";
  onChange: (next: AccessChoice) => void;
  presets: readonly PresetPick[];
  isOwner: boolean;
  invalid?: boolean;
  className?: string;
  includeOwner?: boolean;
  placeholder?: string;
}) {
  const groups = presetGroups(presets, isOwner, { includeOwner });
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
      <SelectTrigger
        id={id}
        data-testid="access-preset-select"
        aria-invalid={invalid || undefined}
        className={[invalid ? "border-destructive" : "", className ?? ""].join(" ").trim()}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectGroup key={g.key}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
