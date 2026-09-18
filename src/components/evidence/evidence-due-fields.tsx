import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeFirstDueOn,
  firstDueOptionsForSubject,
  needsHireDate,
  NEXT_DUE_OPTIONS,
  type EvidenceDueDraft,
} from "@/lib/evidence/due.ts";
import type { EvidenceSubject } from "@/lib/evidence/types.ts";

export function EvidenceDueFields({
  subject,
  hireDate,
  value,
  onChange,
  showDocumentDate,
  documentDate,
  onDocumentDateChange,
  compact,
}: {
  subject: EvidenceSubject;
  hireDate?: string | null;
  value: EvidenceDueDraft;
  onChange: (next: EvidenceDueDraft) => void;
  showDocumentDate?: boolean;
  documentDate?: string;
  onDocumentDateChange?: (next: string) => void;
  compact?: boolean;
}) {
  const firstOptions = firstDueOptionsForSubject(subject);
  const hireMissing = needsHireDate({
    subject,
    rule: value.firstDueRule,
    hireDate,
    firstDueOn: value.firstDueOn,
  });
  const computedFirst = computeFirstDueOn({
    rule: value.firstDueRule,
    hireDate,
    setDate: value.firstDueOn,
  });
  const nextValue =
    value.nextDueMode === "years" && value.renewYears === 1
      ? "1"
      : value.nextDueMode === "years" && value.renewYears === 2
        ? "2"
        : value.nextDueMode === "set_date"
          ? "set_date"
          : "none";

  return (
    <div className={compact ? "mt-2 space-y-2" : "space-y-3"}>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">First due</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {firstOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, firstDueRule: opt.value })}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                value.firstDueRule === opt.value
                  ? "border-[var(--hive-accent,#2f6fed)] bg-[var(--hive-accent,#2f6fed)]/10 font-semibold"
                  : "border-border bg-background"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {value.firstDueRule === "set_date" ? (
          <div className="mt-2 grid gap-1.5">
            <Label className="text-xs">First due date</Label>
            <Input
              type="date"
              value={value.firstDueOn ?? ""}
              onChange={(e) => onChange({ ...value, firstDueOn: e.target.value || null })}
            />
          </div>
        ) : computedFirst ? (
          <p className="mt-1 text-xs text-muted-foreground">Due {computedFirst}</p>
        ) : null}
        {hireMissing ? (
          <p className="mt-1 text-xs text-rose-700">
            Needs a hire date on this employee, or Set a date.
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground">Next due after on file</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {NEXT_DUE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (opt.value === "1") {
                  onChange({ ...value, nextDueMode: "years", renewYears: 1, nextDueOn: null });
                  return;
                }
                if (opt.value === "2") {
                  onChange({ ...value, nextDueMode: "years", renewYears: 2, nextDueOn: null });
                  return;
                }
                if (opt.value === "set_date") {
                  onChange({ ...value, nextDueMode: "set_date", renewYears: null });
                  return;
                }
                onChange({ ...value, nextDueMode: "none", renewYears: null, nextDueOn: null });
              }}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                nextValue === opt.value
                  ? "border-[var(--hive-accent,#2f6fed)] bg-[var(--hive-accent,#2f6fed)]/10 font-semibold"
                  : "border-border bg-background"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {value.nextDueMode === "set_date" ? (
          <div className="mt-2 grid gap-1.5">
            <Label className="text-xs">Next due date</Label>
            <Input
              type="date"
              value={value.nextDueOn ?? ""}
              onChange={(e) => onChange({ ...value, nextDueOn: e.target.value || null })}
            />
          </div>
        ) : null}
      </div>

      {showDocumentDate ? (
        <div className="grid gap-1.5">
          <Label className="text-xs">Document / certificate date</Label>
          <Input
            type="date"
            value={documentDate ?? ""}
            onChange={(e) => onDocumentDateChange?.(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
