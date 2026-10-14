// Shared pieces for the medication form: a labeled field with its inline
// error and the "suggested" note, a yes/no pair, a checkbox row and a file
// upload that stores the private path.

import { useRef, useState, type ReactNode } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SUGGESTION_NOTE } from "@/lib/medications/reference";
import { medicationFileLabel, type MedicationFileKind } from "@/lib/medications/med-files";
import type { MedFormKey, MedFormValues, SuggestedField } from "@/lib/medications/med-form";
import { useMedicationFiles } from "./use-medications";

export type FormPartProps = {
  v: MedFormValues;
  set: (patch: Partial<MedFormValues>) => void;
  errors: Partial<Record<MedFormKey, string>>;
  suggested: ReadonlySet<SuggestedField>;
  clientId: string;
};

export function FormField({
  label,
  error,
  suggested,
  hint,
  wide,
  children,
}: {
  label: string;
  error?: string;
  suggested?: boolean;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", wide && "sm:col-span-2")}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {suggested ? (
        <p className="text-[11px] text-[var(--hive-info-fg)]">{SUGGESTION_NOTE}</p>
      ) : null}
      {error ? <p className="text-xs text-[var(--hive-danger-fg)]">{error}</p> : null}
    </div>
  );
}

export function PartHeading({ children }: { children: ReactNode }) {
  return <h4 className="pt-2 text-sm font-semibold text-hive-ink sm:col-span-2">{children}</h4>;
}

export function YesNo({
  value,
  onChange,
  testId,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex gap-2" data-testid={testId}>
      {[true, false].map((opt) => (
        <Button
          key={String(opt)}
          type="button"
          size="sm"
          variant={value === opt ? "default" : "outline"}
          onClick={() => onChange(opt)}
        >
          {opt ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  children,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm sm:col-span-2" data-testid={testId}>
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      {children}
    </label>
  );
}

export function FileField({
  clientId,
  kind,
  path,
  onChange,
  label,
}: {
  clientId: string;
  kind: MedicationFileKind;
  path: string | null;
  onChange: (path: string | null) => void;
  label: string;
}) {
  const files = useMedicationFiles(clientId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await files.upload(kind, file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Paperclip className="mr-1 h-3.5 w-3.5" />
        )}
        {path ? "Replace" : label}
      </Button>
      {path ? (
        <>
          <button type="button" className="text-xs underline" onClick={() => void files.open(path)}>
            {medicationFileLabel(path)}
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => onChange(null)}
          >
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}
