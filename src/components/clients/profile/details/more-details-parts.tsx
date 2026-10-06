// Pieces of the More details panel: one custom field row (value + save +
// delete) and the "Add a detail" dialog.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CustomFieldWithValue } from "@/lib/clients/care-data.functions";
import {
  createCustomFieldDefinition,
  setCustomFieldValue,
} from "@/lib/clients/custom-fields.functions";
import { SECTION_LABEL, SECTION_NAMES, type SectionName } from "@/lib/clients/staff-visibility";

type DataType = "text" | "number" | "boolean" | "date";

export function CustomFieldRow({
  clientId,
  orgId,
  field,
  selected,
  onSelectedChange,
  onDelete,
  deletePending,
}: {
  clientId: string;
  orgId: string | null;
  field: CustomFieldWithValue;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setCustomFieldValue);

  const initial = coerceInitial(field);
  const [value, setValue] = useState<string | boolean | null>(initial);

  const saveMut = useMutation({
    mutationFn: (v: string | boolean | null) => {
      if (!orgId) throw new Error("Missing organization");
      const payload = {
        organizationId: orgId,
        definitionId: field.id,
        entityKind: "client" as const,
        entityId: clientId,
        value_text: null as string | null,
        value_number: null as number | null,
        value_boolean: null as boolean | null,
        value_date: null as string | null,
      };
      if (field.data_type === "text") payload.value_text = (v as string) || null;
      else if (field.data_type === "number")
        payload.value_number = v === "" || v === null ? null : Number(v);
      else if (field.data_type === "boolean")
        payload.value_boolean = typeof v === "boolean" ? v : false;
      else if (field.data_type === "date") payload.value_date = (v as string) || null;
      return saveFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelectedChange(v === true)}
        aria-label={`Select ${field.field_label}`}
      />
      <Label className="min-w-[140px] text-sm font-medium">{field.field_label}</Label>

      <div className="flex-1 min-w-[180px]">
        {field.data_type === "boolean" ? (
          <Switch checked={value === true} onCheckedChange={(v) => setValue(v)} />
        ) : (
          <Input
            type={
              field.data_type === "number" ? "number" : field.data_type === "date" ? "date" : "text"
            }
            value={value === null || value === false || value === true ? "" : String(value)}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
        )}
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => saveMut.mutate(value)}
        disabled={saveMut.isPending}
      >
        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${field.field_label}`}
        disabled={deletePending}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function coerceInitial(f: CustomFieldWithValue): string | boolean | null {
  const v = f.value;
  if (!v) return f.data_type === "boolean" ? false : "";
  switch (f.data_type) {
    case "text":
      return v.value_text ?? "";
    case "number":
      return v.value_number == null ? "" : String(v.value_number);
    case "boolean":
      return v.value_boolean ?? false;
    case "date":
      return v.value_date ?? "";
  }
}

/** Add a custom detail field (it appears on every client). */
export function AddCustomFieldButton({ clientId, orgId }: { clientId: string; orgId: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCustomFieldDefinition);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState<DataType>("text");
  const [section, setSection] = useState<SectionName>("identity");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organizationId: orgId,
          entityKind: "client",
          section,
          field_label: label.trim(),
          data_type: dataType,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
      setLabel("");
      setDataType("text");
      setOpen(false);
      toast.success("Detail field added");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to add"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add a detail
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a detail field</DialogTitle>
          <DialogDescription>
            The field is added for every client. Staff see it when its group is shared with them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cf-label">Label</Label>
            <Input
              id="cf-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Preferred pharmacy"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cf-type">Type</Label>
            <select
              id="cf-type"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={dataType}
              onChange={(e) => setDataType(e.target.value as DataType)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="boolean">Yes / No</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cf-section">Staff visibility group</Label>
            <select
              id="cf-section"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={section}
              onChange={(e) => setSection(e.target.value as SectionName)}
            >
              {SECTION_NAMES.map((s) => (
                <option key={s} value={s}>
                  {SECTION_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!label.trim() || mut.isPending}>
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
