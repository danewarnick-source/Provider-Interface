import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCaptcha, readAuthCaptchaToken, resetAuthCaptcha } from "@/components/auth-captcha";
import { confirmMedWitness } from "@/lib/medications/med-witness.functions";

export interface ControlledValues {
  before: string;
  after: string;
  witnessConfirmationId: string | null;
  witnessName: string | null;
}

/** Count before and after a controlled dose, and the witness sign-in when one is needed. */
export function ControlledFields({
  clientId,
  medicationId,
  needsWitness,
  values,
  onChange,
}: {
  clientId: string;
  medicationId: string;
  needsWitness: boolean;
  values: ControlledValues;
  onChange: (v: ControlledValues) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">Count</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="count-before">Before the dose *</Label>
          <Input
            id="count-before"
            inputMode="numeric"
            value={values.before}
            onChange={(e) => onChange({ ...values, before: e.target.value.replace(/[^\d-]/g, "") })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="count-after">After the dose *</Label>
          <Input
            id="count-after"
            inputMode="numeric"
            value={values.after}
            onChange={(e) => onChange({ ...values, after: e.target.value.replace(/[^\d-]/g, "") })}
            className="mt-1"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Count what's really there. If it doesn't match the record, the count is flagged for an
        admin.
      </p>
      {needsWitness ? (
        values.witnessConfirmationId ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Witnessed by {values.witnessName}
          </p>
        ) : (
          <WitnessSignIn
            clientId={clientId}
            medicationId={medicationId}
            onConfirmed={(id, name) =>
              onChange({ ...values, witnessConfirmationId: id, witnessName: name })
            }
          />
        )
      ) : null}
    </div>
  );
}

function WitnessSignIn({
  clientId,
  medicationId,
  onConfirmed,
}: {
  clientId: string;
  medicationId: string;
  onConfirmed: (confirmationId: string, witnessName: string) => void;
}) {
  const confirm = useServerFn(confirmMedWitness);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await confirm({
        data: {
          clientId,
          medicationId,
          identifier,
          password,
          captchaToken: readAuthCaptchaToken(),
        },
      });
      setPassword("");
      onConfirmed(res.confirmationId, res.witnessName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The witness's sign-in didn't work.");
      resetAuthCaptcha();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <p className="text-sm font-medium">Witness signs in</p>
      <p className="text-xs text-muted-foreground">
        Another staff member watches the count and signs in with their own account. They stay signed
        in only for this.
      </p>
      <Input
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Witness email or username"
        autoComplete="off"
        autoCapitalize="none"
      />
      <PasswordInput
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Witness password"
        autoComplete="off"
      />
      <AuthCaptcha />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <Button
        size="sm"
        variant="outline"
        onClick={submit}
        disabled={busy || !identifier.trim() || !password}
      >
        {busy ? "Checking…" : "Confirm witness"}
      </Button>
    </div>
  );
}
