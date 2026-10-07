// Add, edit or renew one authorization by hand. The same checks as the
// server (authorizationProblems) run as you type; Save stays off until the
// line is clean.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UNIT_TYPES,
  authorizationProblems,
  inputFromRow,
  type AuthorizationInput,
  type AuthorizationRow,
} from "@/lib/clients/authorizations";
import { isDailyServiceCode } from "@/lib/service-billing";
import { saveAuthorization } from "@/lib/clients/services.functions";

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function AuthorizationDialog({
  orgId,
  clientId,
  row,
  renew,
  agencyCodes,
  onClose,
  onSaved,
}: {
  orgId: string;
  clientId: string;
  /** null = add a new code. */
  row: AuthorizationRow | null;
  /** An ended row being renewed: same code, new dates and units. */
  renew: boolean;
  agencyCodes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveAuthorization);
  const [input, setInput] = useState<AuthorizationInput>(() => inputFromRow(row, renew));
  const [saving, setSaving] = useState(false);
  const problems = authorizationProblems(input, agencyCodes);
  const set = (patch: Partial<AuthorizationInput>) => setInput((i) => ({ ...i, ...patch }));

  async function save() {
    setSaving(true);
    try {
      await saveFn({
        data: { organizationId: orgId, clientId, id: row && !renew ? row.id : null, input },
      });
      toast.success(`${input.code.toUpperCase()} saved`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the authorization.");
    } finally {
      setSaving(false);
    }
  }

  const field = (id: string, label: string, el: React.ReactNode) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {el}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg" data-testid="authorization-dialog">
        <DialogHeader>
          <DialogTitle>
            {renew
              ? `Renew ${row?.service_code}`
              : row
                ? `Edit ${row.service_code}`
                : "Add an authorization"}
          </DialogTitle>
          <DialogDescription>
            Copy these from the client's 1056. Units must be whole numbers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field(
            "auth-code",
            "Code",
            <Input
              id="auth-code"
              value={input.code}
              disabled={!!row}
              maxLength={4}
              onChange={(e) => {
                const code = e.target.value.toUpperCase();
                set({
                  code,
                  unitType: isDailyServiceCode(code)
                    ? "day"
                    : input.unitType === "day"
                      ? "Q"
                      : input.unitType,
                });
              }}
            />,
          )}
          {field(
            "auth-unit",
            "Unit",
            <select
              id="auth-unit"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={input.unitType}
              onChange={(e) => set({ unitType: e.target.value })}
            >
              {Object.entries(UNIT_TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>,
          )}
          {field(
            "auth-rate",
            "Rate ($ per unit)",
            <Input
              id="auth-rate"
              type="number"
              min={0}
              step="0.01"
              value={input.rate ?? ""}
              onChange={(e) => set({ rate: numOrNull(e.target.value) })}
            />,
          )}
          {field(
            "auth-units",
            "Units per year",
            <Input
              id="auth-units"
              type="number"
              min={0}
              step={1}
              value={input.annualUnits ?? ""}
              onChange={(e) => set({ annualUnits: numOrNull(e.target.value) })}
            />,
          )}
          {field(
            "auth-start",
            "Starts",
            <Input
              id="auth-start"
              type="date"
              value={input.start ?? ""}
              onChange={(e) => set({ start: e.target.value || null })}
            />,
          )}
          {field(
            "auth-end",
            "Ends",
            <Input
              id="auth-end"
              type="date"
              value={input.end ?? ""}
              onChange={(e) => set({ end: e.target.value || null })}
            />,
          )}
          {field(
            "auth-number",
            "1056 number",
            <Input
              id="auth-number"
              value={input.authorizationNumber ?? ""}
              maxLength={40}
              onChange={(e) => set({ authorizationNumber: e.target.value })}
            />,
          )}
          {field(
            "auth-approved",
            "1056 approved",
            <Input
              id="auth-approved"
              type="date"
              value={input.approvedOn ?? ""}
              onChange={(e) => set({ approvedOn: e.target.value || null })}
            />,
          )}
          {field(
            "auth-monthly",
            "Units per month (if capped)",
            <Input
              id="auth-monthly"
              type="number"
              min={0}
              step={1}
              value={input.monthlyMaxUnits ?? ""}
              onChange={(e) => set({ monthlyMaxUnits: numOrNull(e.target.value) })}
            />,
          )}
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-destructive">{problems[0] ?? ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || problems.length > 0}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save authorization
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
