// Settings › Rules: each rule's agency default (Off / Warn / Needs a reason /
// Block), its threshold where it has one, and the homes where it's different.
// State rules offer no Off (strengthChoices). The engine reads these through
// rules-strength.ts; saves go to saveRuleStrength / saveAgencySettings.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  SETTING_RULES,
  strengthChoices,
  strengthOf,
  type SettingRule,
  type Strengths,
} from "@/lib/scheduler/rules-strength";
import type { Strength } from "@/lib/scheduler/rules-types";
import { STRENGTH_LABEL } from "@/lib/scheduler/settings/settings-model";
import {
  saveAgencySettings,
  saveRuleStrength,
} from "@/lib/scheduler/settings/settings-save.functions";
import { Panel, Segmented, Tag, useSettings } from "./settings-controls";
import { STRENGTH_TONE } from "./settings-format";

const ALL: readonly Strength[] = ["off", "warn", "reason", "block"];

function RuleBlock({ rule }: { rule: SettingRule }) {
  const { data, orgId, canEdit, save } = useSettings();
  const saveStrength = useServerFn(saveRuleStrength);
  const saveAgency = useServerFn(saveAgencySettings);
  const agencyRules = (data.agency.rule_settings ?? {}) as Strengths;
  const allowed = strengthChoices(rule);
  const homesById = new Map(data.homes.map((h) => [h.id, h.name] as const));
  const overrides = data.homeSettings
    .map((h) => ({ teamId: h.team_id, s: ((h.rule_overrides ?? {}) as Strengths)[rule.key] }))
    .filter((o): o is { teamId: string; s: Strength } => !!o.s && homesById.has(o.teamId));
  const [home, setHome] = useState(data.homes[0]?.id ?? "");
  const [level, setLevel] = useState<Strength>(allowed[0]!);
  const current = strengthOf(rule, agencyRules);
  const threshold = rule.threshold;
  return (
    <div className="border-t border-[var(--hive-border)] py-3 first:border-t-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[52ch]">
          <b className="text-sm">{rule.label}</b>{" "}
          <Tag tone={rule.state ? "info" : "neutral"}>
            {rule.state ? "State rule" : "Agency rule"}
          </Tag>
          <div className="mt-0.5 text-xs text-muted-foreground">{rule.hint}</div>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          {threshold && (
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Threshold</span>
              <Segmented
                label={`${rule.label} threshold`}
                readOnly={!canEdit}
                value={data.agency[threshold.column]}
                choices={threshold.options.map((o) => ({
                  value: o,
                  label: `${o} ${threshold.unit.split(" ")[0]}`,
                }))}
                onPick={(v) =>
                  save(
                    () =>
                      saveAgency({
                        data: { organizationId: orgId, patch: { [threshold.column]: v } },
                      }),
                    `${rule.label}: ${v} ${threshold.unit} saved`,
                  )
                }
              />
            </span>
          )}
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Agency default</span>
            <Segmented
              label={`${rule.label} agency default`}
              readOnly={!canEdit}
              value={current}
              choices={ALL.map((l) => ({
                value: l,
                label: STRENGTH_LABEL[l],
                disabled: !allowed.includes(l),
                reason: "State rules always at least warn",
              }))}
              onPick={(v) =>
                save(
                  () =>
                    saveStrength({ data: { organizationId: orgId, key: rule.key, strength: v } }),
                  `${rule.label}: ${STRENGTH_LABEL[v]} saved`,
                )
              }
            />
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Different at:</span>
        {overrides.length === 0 && <span className="text-muted-foreground">nowhere</span>}
        {overrides.map((o) => (
          <Tag key={o.teamId} tone={STRENGTH_TONE[o.s]}>
            {homesById.get(o.teamId)}: {STRENGTH_LABEL[o.s]}
            {canEdit && (
              <button
                type="button"
                className="ml-1 min-h-6 px-1"
                aria-label={`Use agency default at ${homesById.get(o.teamId)}`}
                onClick={() =>
                  save(
                    () =>
                      saveStrength({
                        data: {
                          organizationId: orgId,
                          key: rule.key,
                          strength: null,
                          teamId: o.teamId,
                        },
                      }),
                    `${homesById.get(o.teamId)} now uses the agency default for ${rule.label}`,
                  )
                }
              >
                ✕
              </button>
            )}
          </Tag>
        ))}
        {canEdit && data.homes.length > 0 && (
          <span className="flex items-center gap-1.5">
            <select
              className="min-h-11 rounded-md border px-2"
              aria-label="Home"
              value={home}
              onChange={(e) => setHome(e.target.value)}
            >
              {data.homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <select
              className="min-h-11 rounded-md border px-2"
              aria-label="Strength"
              value={level}
              onChange={(e) => setLevel(e.target.value as Strength)}
            >
              {allowed.map((l) => (
                <option key={l} value={l}>
                  {STRENGTH_LABEL[l]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                save(
                  () =>
                    saveStrength({
                      data: { organizationId: orgId, key: rule.key, strength: level, teamId: home },
                    }),
                  `${homesById.get(home)} now: ${STRENGTH_LABEL[level]} for ${rule.label}`,
                )
              }
            >
              Add difference
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

export function RulesTab() {
  return (
    <Panel
      title="Rules"
      sub={
        <>
          Each rule has an agency default and can be different at any home or program. <b>Off</b>{" "}
          ignores it. <b>Warn</b> shows it. <b>Needs a reason</b> lets you continue after writing
          why, and the reason is saved on the shift. <b>Block</b> stops the shift. State rules can't
          be turned off. Two shifts at the same time, a team member under 18 driving clients, and a
          code with no authorization are always blocked.
        </>
      }
    >
      {SETTING_RULES.map((r) => (
        <RuleBlock key={r.key} rule={r} />
      ))}
    </Panel>
  );
}
