// Settings → Access & presets → Presets: the named bundles of settings assigned to people.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteAccessPreset, saveAccessPreset, type AccessPreset } from "@/lib/access/access.functions";
import { effectiveCategories } from "@/lib/access/can";
import type { CategoryId, CategoryValue } from "@/lib/access/categories";
import { LEVEL_LABEL, LEVEL_SUMMARY, SCOPE_LABEL, type AccessScope } from "@/lib/access/levels";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { cn } from "@/lib/utils";
import { CategoryList } from "./category-list";
import { accessKeys, usePresets } from "./queries";

type PresetLevel = AccessPreset["access_level"];

interface Draft {
  id: string | null;
  name: string;
  access_level: PresetLevel;
  access_scope: AccessScope;
  home_page: string;
  categories: Record<CategoryId, CategoryValue>;
}

const toDraft = (p: AccessPreset): Draft => ({
  id: p.id,
  name: p.name,
  access_level: p.access_level,
  access_scope: p.access_scope,
  home_page: p.home_page ?? "",
  categories: effectiveCategories({ level: p.access_level, presetCategories: p.categories }),
});

const blank = (): Draft => ({
  id: null,
  name: "",
  access_level: "admin",
  access_scope: "assigned",
  home_page: "",
  categories: effectiveCategories({ level: "admin", presetCategories: {} }),
});

export function PresetsPanel({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const presetsQ = usePresets(orgId);
  const saveFn = useServerFn(saveAccessPreset);
  const deleteFn = useServerFn(deleteAccessPreset);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const presets = presetsQ.data ?? [];
  const viewed = presets.find((p) => p.id === viewId) ?? presets[0];
  const selected = draft ?? (viewed ? toDraft(viewed) : null);
  const editing = canEdit && !!draft;
  const refresh = () => qc.invalidateQueries({ queryKey: accessKeys.presets(orgId) });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          organization_id: orgId,
          id: d.id,
          name: d.name,
          access_level: d.access_level,
          access_scope: d.access_scope,
          home_page: d.home_page || null,
          categories: d.categories,
        },
      }),
    onSuccess: () => {
      toast.success("Preset saved");
      setDraft(null);
      refresh();
      qc.invalidateQueries({ queryKey: ["current-org"] });
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save preset")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { organization_id: orgId, id } }),
    onSuccess: () => {
      toast.success("Preset deleted");
      setDraft(null);
      refresh();
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not delete preset")),
  });

  if (presetsQ.isLoading) return <p className="text-sm text-muted-foreground">Loading presets…</p>;
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...(d ?? selected!), ...p }));

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-2">
        {(["admin", "staff"] as const).map((level) => (
          <div key={level} className="space-y-1">
            <div className="px-2 text-[11px] uppercase tracking-wide text-muted-foreground">{LEVEL_LABEL[level]}</div>
            {presets
              .filter((p) => p.access_level === level)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setViewId(p.id);
                    setDraft(canEdit ? toDraft(p) : null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--hive-hover)]",
                    selected?.id === p.id && "bg-accent/60 font-medium",
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  <Badge variant="outline" className="text-[10px]">{p.member_count}</Badge>
                </button>
              ))}
          </div>
        ))}
        {canEdit && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setDraft(blank())}>
            <Plus className="mr-1 h-4 w-4" /> New preset
          </Button>
        )}
      </aside>

      {selected && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              {editing ? <Input value={selected.name} onChange={(e) => patch({ name: e.target.value })} /> : selected.name}
            </Field>
            <Field label="Access level">
              {editing && !selected.id ? (
                <Select
                  value={selected.access_level}
                  onValueChange={(v) =>
                    patch({
                      access_level: v as PresetLevel,
                      access_scope: v === "staff" ? "self" : "assigned",
                      categories: effectiveCategories({ level: v as PresetLevel, presetCategories: {} }),
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{LEVEL_LABEL.admin}</SelectItem>
                    <SelectItem value="staff">{LEVEL_LABEL.staff}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                LEVEL_LABEL[selected.access_level]
              )}
            </Field>
            <Field label="Default “sees”">
              {editing ? (
                <Select value={selected.access_scope} onValueChange={(v) => patch({ access_scope: v as AccessScope })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["agency", "assigned", "self"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                SCOPE_LABEL[selected.access_scope]
              )}
            </Field>
            <Field label="Home page (optional)">
              {editing ? (
                <Input
                  value={selected.home_page}
                  placeholder={selected.access_level === "staff" ? "/employee" : "/dashboard"}
                  onChange={(e) => patch({ home_page: e.target.value })}
                />
              ) : (
                selected.home_page || "Default"
              )}
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{LEVEL_SUMMARY[selected.access_level]}</p>

          <CategoryList
            level={selected.access_level}
            values={selected.categories}
            editing={editing}
            onChange={(id, v) => patch({ categories: { ...selected.categories, [id]: v } })}
          />

          {editing && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button onClick={() => save.mutate(selected)} disabled={save.isPending || !selected.name.trim()}>
                {save.isPending ? "Saving…" : "Save preset"}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              {selected.id && (
                <Button
                  variant="ghost"
                  className="ml-auto text-destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(selected.id!)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          )}
        </section>
      )}
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
