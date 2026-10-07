// More details: the agency's custom client fields as small tiles (shown only
// when the agency has any). Editors open edit mode to change values, add a
// field or delete fields; a delete removes the field for every client.
// Select all / Delete selected work on the whole list.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListPlus, Loader2, Trash2 } from "lucide-react";
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
import { deleteCustomFieldDefinitions } from "@/lib/clients/custom-fields.functions";
import { chunkIds, customFieldDeleteCopy } from "@/lib/clients/custom-fields-delete";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { DetailTile } from "./detail-tile";
import { AddCustomFieldButton, CustomFieldRow } from "./more-details-parts";

export function MoreDetailsCard({ clientId }: { clientId: string }) {
  const care = useClientCareData(clientId);
  const canEdit = useAccess().canCategory("clients", "edit");
  const orgId = care.data?.identity.organization_id ?? null;
  const qc = useQueryClient();
  const fields = useMemo(() => care.data?.custom_fields ?? [], [care.data]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; labels: string[] } | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const valid = new Set(fields.map((f) => f.id));
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
  }, [fields]);

  const deleteFn = useServerFn(deleteCustomFieldDefinitions);
  const delMut = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!orgId) throw new Error("Missing organization");
      if (!ids.length) throw new Error("Nothing selected");
      let deleted = 0;
      for (const batch of chunkIds(ids, 200)) {
        const res = await deleteFn({
          data: { organizationId: orgId, definitionIds: batch },
        });
        deleted += res?.deleted ?? 0;
      }
      return { ok: true as const, deleted };
    },
    onSuccess: (_res, ids) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setConfirm(null);
      toast.success(
        ids.length === 1 ? "Custom field deleted" : `${ids.length} custom fields deleted`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
    },
  });

  const allSelected = fields.length > 0 && fields.every((f) => selected.has(f.id));
  const someSelected = fields.some((f) => selected.has(f.id));
  const selectedFields = fields.filter((f) => selected.has(f.id));
  const copy = customFieldDeleteCopy(confirm?.labels ?? []);

  function requestDelete(ids: string[]) {
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

  if (!fields.length) {
    return canEdit && orgId ? (
      <SectionCard {...card}>
        <EmptyState action={<AddCustomFieldButton clientId={clientId} orgId={orgId} />}>
          Need to track something else about clients? Add a detail field.
        </EmptyState>
      </SectionCard>
    ) : null;
  }

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
                  label: `Delete selected fields${selectedFields.length ? ` (${selectedFields.length})` : ""}`,
                  danger: true,
                  disabled: !selectedFields.length || delMut.isPending,
                  onSelect: () => requestDelete(selectedFields.map((f) => f.id)),
                },
              ]}
            />
          </>
        ) : null
      }
    >
      {!editing ? (
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
                setSelected(v === true ? new Set(fields.map((f) => f.id)) : new Set())
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
              onDelete={() => requestDelete([f.id])}
              deletePending={delMut.isPending && (confirm?.ids.includes(f.id) ?? false)}
            />
          ))}
        </ul>
      ) : null}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !delMut.isPending) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delMut.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending || !confirm?.ids.length}
              onClick={() => confirm?.ids.length && delMut.mutate(confirm.ids)}
            >
              {delMut.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              {confirm && confirm.ids.length > 1 ? "Delete selected" : "Delete field"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
