// Employee profile → Access: level, preset, scope, assignments, and the 18 settings.
// Owners edit; Admins with staff-roster access see it read-only.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import { useAccess } from "@/hooks/use-access";
import { setMemberAccess, type AccessPreset } from "@/lib/access/access.functions";
import { effectiveCategories } from "@/lib/access/can";
import type { CategoryId, CategoryValue } from "@/lib/access/categories";
import {
  ACCESS_LEVELS,
  ACCESS_SCOPES,
  LEVEL_LABEL,
  LEVEL_SUMMARY,
  SCOPE_LABEL,
  type AccessLevel,
  type AccessScope,
  type AssignmentKind,
} from "@/lib/access/levels";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { CategoryList } from "./category-list";
import { accessKeys, useAccessTargets, useMemberAccess, usePresets } from "./queries";

interface Draft {
  level: AccessLevel;
  presetId: string | null;
  scope: AccessScope;
  categories: Record<CategoryId, CategoryValue>;
  assigned: Record<AssignmentKind, string[]>;
}

const KIND_LABEL: Record<AssignmentKind, string> = {
  home: "Homes",
  staff: "Team members",
  client: "Clients",
};
const KINDS: AssignmentKind[] = ["home", "staff", "client"];

function presetCats(presets: AccessPreset[] | undefined, id: string | null, level: AccessLevel) {
  return effectiveCategories({ level, presetCategories: presets?.find((p) => p.id === id)?.categories });
}

export function AccessSection({ orgId, staffId }: { orgId: string; staffId: string }) {
  const { isOwner } = useAccess();
  const qc = useQueryClient();
  const saveFn = useServerFn(setMemberAccess);
  const presetsQ = usePresets(orgId);
  const memberQ = useMemberAccess(orgId, staffId);
  const [editing, setEditing] = useState(false);
  const targetsQ = useAccessTargets(orgId, editing);

  const saved = useMemo((): Draft | null => {
    const m = memberQ.data;
    if (!m) return null;
    const assigned: Draft["assigned"] = { home: [], staff: [], client: [] };
    m.assignments.forEach((a) => assigned[a.kind].push(a.target_id));
    return {
      level: m.access_level,
      presetId: m.access_preset_id,
      scope: m.access_scope,
      categories: effectiveCategories({
        level: m.access_level,
        presetCategories: presetsQ.data?.find((p) => p.id === m.access_preset_id)?.categories,
        overrides: m.access_overrides,
      }),
      assigned,
    };
  }, [memberQ.data, presetsQ.data]);

  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [saved, editing]);

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          organization_id: orgId,
          user_id: staffId,
          access_level: d.level,
          access_preset_id: d.level === "owner" ? null : d.presetId,
          access_scope: d.scope,
          categories: d.categories,
          assignments: KINDS.flatMap((kind) => d.assigned[kind].map((target_id) => ({ kind, target_id }))),
        },
      }),
    onSuccess: () => {
      toast.success("Access saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: accessKeys.member(orgId, staffId) });
      qc.invalidateQueries({ queryKey: ["team-access"] });
      qc.invalidateQueries({ queryKey: ["current-org"] });
      qc.invalidateQueries({ queryKey: ["staff-profile"] });
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save access")),
  });

  const shown = editing ? draft : saved;
  if (memberQ.isLoading || presetsQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access…</p>;
  }
  if (!shown) return <p className="text-sm text-muted-foreground">No membership in this agency.</p>;

  const presetsForLevel = (presetsQ.data ?? []).filter((p) => p.access_level === shown.level);
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const pickLevel = (level: AccessLevel) => {
    const first = (presetsQ.data ?? []).find((p) => p.access_level === level) ?? null;
    patch({
      level,
      presetId: first?.id ?? null,
      scope: level === "owner" ? "agency" : (first?.access_scope ?? "self"),
      categories: presetCats(presetsQ.data, first?.id ?? null, level),
    });
  };
  const pickPreset = (id: string) => {
    const p = presetsQ.data?.find((x) => x.id === id);
    patch({ presetId: id, scope: p?.access_scope ?? shown.scope, categories: presetCats(presetsQ.data, id, shown.level) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Access</h2>
          <p className="text-sm text-muted-foreground">{LEVEL_SUMMARY[shown.level]}</p>
        </div>
        {isOwner &&
          (editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => draft && save.mutate(draft)} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save access"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit access
            </Button>
          ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Access level">
          {editing ? (
            <Select value={shown.level} onValueChange={(v) => pickLevel(v as AccessLevel)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCESS_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            LEVEL_LABEL[shown.level]
          )}
        </Field>
        {shown.level !== "owner" && (
          <>
            <Field label="Preset">
              {editing ? (
                <Select value={shown.presetId ?? ""} onValueChange={pickPreset}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Pick a preset" /></SelectTrigger>
                  <SelectContent>
                    {presetsForLevel.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                (presetsQ.data?.find((p) => p.id === shown.presetId)?.name ?? "None")
              )}
            </Field>
            <Field label="Sees">
              {editing ? (
                <Select value={shown.scope} onValueChange={(v) => patch({ scope: v as AccessScope })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCESS_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                SCOPE_LABEL[shown.scope]
              )}
            </Field>
          </>
        )}
      </div>

      {shown.level !== "owner" && shown.scope === "assigned" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div>
            <h3 className="text-sm font-semibold">Assigned to</h3>
            <p className="text-xs text-muted-foreground">
              A home covers its clients and team members. People can be assigned to several managers; each sees the
              full record within their own settings.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {KINDS.map((kind) => (
              <Field key={kind} label={KIND_LABEL[kind]}>
                {editing ? (
                  <CheckboxMultiSelect
                    value={shown.assigned[kind]}
                    onChange={(ids) => patch({ assigned: { ...shown.assigned, [kind]: ids } })}
                    options={(targetsQ.data?.[kind] ?? []).map((t) => ({ value: t.id, label: t.label }))}
                    placeholder={targetsQ.isLoading ? "Loading…" : `Pick ${KIND_LABEL[kind].toLowerCase()}`}
                  />
                ) : (
                  `${shown.assigned[kind].length} assigned`
                )}
              </Field>
            ))}
          </div>
        </div>
      )}

      <CategoryList
        level={shown.level}
        values={shown.categories}
        presetValues={shown.level === "owner" ? undefined : presetCats(presetsQ.data, shown.presetId, shown.level)}
        editing={editing}
        onChange={(id, v) => patch({ categories: { ...shown.categories, [id]: v } })}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
