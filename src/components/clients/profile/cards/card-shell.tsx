// Shared look for the record cards in the Health, Plans and Client file
// sections: card frame with an edit pencil, label/value rows, group headers
// and a labeled input.

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/clients/dates";

/** MM/DD/YYYY for a date-only value; "—" when blank. */
export function fmtDate(s: string | null | undefined): string {
  return formatDate(s, { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">
        {children ?? <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}

export function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground/80 mt-4 mb-1.5 first:mt-0">
      {children}
    </div>
  );
}

export function HexMarker() {
  // Honeycomb marker — small hex with inner dot, themed via primary.
  const hex = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  return (
    <span
      aria-hidden
      className="grid place-items-center h-[18px] w-[18px] bg-primary/15 flex-none"
      style={{ clipPath: hex }}
    >
      <span className="block h-[7px] w-[7px] bg-primary" style={{ clipPath: hex }} />
    </span>
  );
}

export function CardShell({
  title,
  subtitle,
  editing,
  onEdit,
  onSave,
  onCancel,
  saving,
  children,
  headerRight,
  canEdit: canEditProp,
}: {
  title: string;
  subtitle?: string;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  children: ReactNode;
  headerRight?: ReactNode;
  /** Overrides the default Clients: Edit check (e.g. Client medical: Edit). */
  canEdit?: boolean;
}) {
  const canEditClients = useAccess().can("edit_client_records");
  const canEdit = canEditProp ?? canEditClients;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            {onEdit && !editing && canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div>{children}</div>
          {editing ? (
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
