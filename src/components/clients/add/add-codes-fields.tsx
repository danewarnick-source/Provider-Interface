import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AddClientForm, CodeLine, FilledField } from "@/lib/clients/create";
import { DspdCodesMultiSelect } from "./dspd-codes-multiselect";
import { FromPcspTag } from "./add-identity-fields";

const newLine = (code: string): CodeLine => ({
  code,
  waiting: true,
  start: null,
  end: null,
  units: null,
  rate: null,
});

/** Service codes: dates and yearly units from the 1056, or "waiting on 1056". */
export function AddCodesFields({
  form,
  set,
  filled,
  onMenuOpenChange,
}: {
  form: AddClientForm;
  set: (patch: Partial<AddClientForm>) => void;
  filled: FilledField[];
  onMenuOpenChange: (open: boolean) => void;
}) {
  const codes = form.codes.map((c) => c.code);
  const update = (i: number, patch: Partial<CodeLine>) =>
    set({ codes: form.codes.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold">
        Service codes
        <FromPcspTag show={filled.includes("codes")} />
      </h4>
      <DspdCodesMultiSelect
        value={codes}
        onOpenChange={onMenuOpenChange}
        onChange={(next) =>
          set({
            codes: next.map((code) => form.codes.find((c) => c.code === code) ?? newLine(code)),
          })
        }
      />
      {form.codes.map((c, i) => (
        <div
          key={c.code}
          className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-[4rem_1fr_1fr_6rem_auto]"
          data-testid={`code-line-${c.code}`}
        >
          <span className="self-center font-mono text-sm font-semibold">{c.code}</span>
          <label className="col-span-1 flex items-center gap-1.5 text-xs sm:col-span-4 sm:hidden">
            <Checkbox checked={c.waiting} onCheckedChange={(v) => update(i, { waiting: !!v })} />{" "}
            Waiting on 1056
          </label>
          <Input
            type="date"
            aria-label={`${c.code} start`}
            value={c.start ?? ""}
            disabled={c.waiting}
            onChange={(e) => update(i, { start: e.target.value || null })}
          />
          <Input
            type="date"
            aria-label={`${c.code} end`}
            value={c.end ?? ""}
            disabled={c.waiting}
            onChange={(e) => update(i, { end: e.target.value || null })}
          />
          <Input
            type="number"
            min={0}
            aria-label={`${c.code} units per year`}
            placeholder="Units/yr"
            value={c.units ?? ""}
            disabled={c.waiting}
            onChange={(e) =>
              update(i, {
                units:
                  e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))),
              })
            }
          />
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-1.5 whitespace-nowrap text-xs sm:flex">
              <Checkbox checked={c.waiting} onCheckedChange={(v) => update(i, { waiting: !!v })} />{" "}
              Waiting on 1056
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Remove ${c.code}`}
              onClick={() => set({ codes: form.codes.filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {form.codes.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Codes waiting on the 1056 are saved as pending: no shifts or billing until the
          authorization is entered.
        </p>
      )}
    </section>
  );
}
