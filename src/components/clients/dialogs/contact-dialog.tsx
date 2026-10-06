import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_ROLES,
  CONTACT_ROLE_LABELS,
  type ClientContact,
  type ContactFields,
  type ContactRole,
} from "@/lib/clients/contacts";

type Draft = Record<Exclude<keyof ContactFields, "role" | "is_primary">, string> & {
  role: ContactRole;
  is_primary: boolean;
};

function toDraft(c: Partial<ClientContact> | null, role: ContactRole): Draft {
  return {
    role: c?.role ?? role,
    name: c?.name ?? "",
    relationship: c?.relationship ?? "",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    address: c?.address ?? "",
    company: c?.company ?? "",
    notes: c?.notes ?? "",
    is_primary: c?.is_primary ?? false,
  };
}

/** Add or edit one contact. `contact` null = add. */
export function ContactDialog({
  open,
  onOpenChange,
  contact,
  defaultRole = "emergency",
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ClientContact | null;
  defaultRole?: ContactRole;
  saving: boolean;
  onSave: (fields: ContactFields) => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(contact, defaultRole));
  useEffect(() => {
    if (open) setD(toDraft(contact, defaultRole));
  }, [open, contact, defaultRole]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const text = (k: Exclude<keyof Draft, "role" | "is_primary">, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      <Input type={type} value={d[k]} onChange={(e) => set(k, e.target.value)} maxLength={200} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Role</Label>
            <Select value={d.role} onValueChange={(v) => set("role", v as ContactRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {CONTACT_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {text("name", "Name *")}
            {text("relationship", "Relationship")}
            {text("phone", "Phone", "tel")}
            {text("email", "Email", "email")}
            {text("company", "Company / practice")}
          </div>
          {text("address", "Address")}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Notes</Label>
            <Textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={d.is_primary} onCheckedChange={(v) => set("is_primary", !!v)} />
            Main {CONTACT_ROLE_LABELS[d.role].toLowerCase()}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onSave(d)} disabled={saving || !d.name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
