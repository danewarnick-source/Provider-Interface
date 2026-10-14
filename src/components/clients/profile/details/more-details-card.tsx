// More details: the agency's own client fields as small tiles. Editors open edit mode to change values, add a
// field, or archive / restore fields. Archiving applies to every client: the field takes no new values, but
// values already saved still show, labelled as an archived field. Nothing is deleted.
// Select all / Archive selected work on the whole list.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccess } from "@/hooks/use-access";
import { useClientCareData } from "@/hooks/use-client-care-data";
import {
  archiveCustomFieldDefinitions,
  restoreCustomFieldDefinition,
} from "@/lib/clients/custom-fields.functions";
import { chunkIds, customFieldArchiveCopy } from "@/lib/clients/custom-fields-archive";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { moreDetailsFields } from "@/lib/clients/more-details";
import { DetailTile } from "./detail-tile";
import { AddCustomFieldButton, CustomFieldRow } from "./more-details-parts";

export function MoreDetailsCard({ clientId }: { clientId: string }) {
  const care = useClientCareData(clientId);
  const canEdit = useAccess().canCategory("clients", "edit");
  const orgId = care.data?.identity.organization_id ?? null;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; labels: string[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const fields = useMemo(
    () => moreDetailsFields(care.data?.custom_fields ?? [], { editing }),
    [care.data, editing],
  );
  const activeFields = useMemo(() => fields.filter((f) => !f.archived), [fields]);

  useEffect(() => {
    const valid = new Set(activeFields.map((f) => f.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [activeFields]);

  const archiveFn = useServerFn(archiveCustomFieldDefinitions);
  const restoreFn = useServerFn(restoreCustomFieldDefinition);
  const archiveMut = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!orgId) throw new Error("Missing organization");
      if (!ids.length) throw new Error("Nothing selected");
      let archived = 0;
      for (const batch of chunkIds(ids, 200)) {
        const res = await archiveFn({
          data: { organizationId: orgId, entityKind: "client", definitionIds: batch },
        });
        archived += res?.archived ?? 0;
      }
      return { ok: true as const, archived };
    },
    onSuccess: (_res, ids) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setConfirm(null);
      toast.success(
        ids.length === 1 ? "Custom field archived" : `${ids.length} custom fields archived`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to archive"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
    },
  });
  const restoreMut = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("Missing organization");
      return restoreFn({ data: { organizationId: orgId, entityKind: "client", definitionId: id } });
    },
    onSuccess: () => toast.success("Custom field restored"),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to restore"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
    },
  });

  const allSelected = activeFields.length > 0 && activeFields.every((f) => selected.has(f.id));
  const someSelected = activeFields.some((f) => selected.has(f.id));
  const selectedFields = activeFields.filter((f) => selected.has(f.id));
  const copy = customFieldArchiveCopy(confirm?.labels ?? []);

  function requestArchive(ids: string[]) {
    if (!ids.length) return;
    const labels = fields.filter((f) => ids.includes(f.id)).map((f) => f.field_label);
    setConfirm({ ids, labels });
  }

  const card = {
    icon: ListPlus,
    tone: "profile" as const,
    title: "More details",
    description: "Your agency's own fields, the same on every client.",
  };

  return (
    <SectionCard
      {...card}
      actions={
        canEdit && orgId && !editing ? (
          <EditButton label="Edit more details" onClick={() => setEditing(true)} />
        ) : canEdit && orgId ? (
          <>
            <AddCustomFieldButton clientId={clientId} orgId={orgId} />
            <Button variant="outline" onClick={() => setEditing(false)}>
              Done editing
            </Button>
            <RowMenu
              label="More actions for More details"
              items={[
                {
                  label: `Archive selected fields${selectedFields.length ? ` (${selectedFields.length})` : ""}`,
                  danger: true,
                  disabled: !selectedFields.length || archiveMut.isPending,
                  onSelect: () => requestArchive(selectedFields.map((f) => f.id)),
                },
              ]}
            />
          </>
        ) : null
      }
    >
      {!editing && fields.length === 0 ? (
        <EmptyState
          testId="client-more-details-empty"
          action={
            canEdit && orgId ? <AddCustomFieldButton clientId={clientId} orgId={orgId} /> : null
          }
        >
          No agency fields yet.
        </EmptyState>
      ) : null}
      {!editing && fields.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="client-more-details">
          {fields.map((f) => (
            <DetailTile key={f.id} field={f} />
          ))}
        </ul>
      ) : null}
      {editing ? (
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) =>
                setSelected(v === true ? new Set(activeFields.map((f) => f.id)) : new Set())
              }
              aria-label="Select all custom fields"
            />
            Select all
          </label>
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        </div>
      ) : null}
      {editing ? (
        <ul className="space-y-2" data-testid="client-more-details-edit">
          {fields.map((f) => (
            <CustomFieldRow
              key={f.id}
              clientId={clientId}
              orgId={orgId}
              field={f}
              selected={selected.has(f.id)}
              onSelectedChange={(checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(f.id);
                  else next.delete(f.id);
                  return next;
                })
              }
              onArchive={() => requestArchive([f.id])}
              archivePending={archiveMut.isPending && (confirm?.ids.includes(f.id) ?? false)}
              onRestore={() => restoreMut.mutate(f.id)}
              restorePending={restoreMut.isPending && restoreMut.variables === f.id}
            />
          ))}
        </ul>
      ) : null}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !archiveMut.isPending) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMut.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={archiveMut.isPending || !confirm?.ids.length}
              onClick={() => confirm?.ids.length && archiveMut.mutate(confirm.ids)}
            >
              {archiveMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="mr-1 h-3.5 w-3.5" />
              )}
              {confirm && confirm.ids.length > 1 ? "Archive selected" : "Archive field"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
