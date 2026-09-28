import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
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
import {
  resetMemberPassword,
  type ResetMemberPasswordResult,
} from "@/lib/team-members/members.functions";
import { rosterQueryKey } from "@/lib/team-members/roster";

export type ResetPasswordTarget = { userId: string; name: string };

/**
 * Reset password: confirm, then the server generates a 14-character temporary
 * password. It is shown once, with the person's login (username or email).
 */
export function ResetPasswordDialog({
  organizationId,
  target,
  onClose,
}: {
  organizationId: string | null;
  target: ResetPasswordTarget | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const resetFn = useServerFn(resetMemberPassword);
  const [result, setResult] = useState<ResetMemberPasswordResult | null>(null);

  const reset = useMutation({
    mutationFn: async () => {
      if (!organizationId || !target) throw new Error("No team member selected.");
      return await resetFn({ data: { organizationId, userId: target.userId } });
    },
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = () => {
    setResult(null);
    reset.reset();
    onClose();
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}. Select it and copy by hand.`);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent data-testid="reset-password-dialog">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Reset password for {target?.name}?</DialogTitle>
              <DialogDescription>
                A new temporary password is created for them. Their current password stops working
                and they must choose a new one the next time they sign in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={reset.isPending}>
                Cancel
              </Button>
              <Button onClick={() => reset.mutate()} disabled={reset.isPending}>
                {reset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Share these sign-in details</DialogTitle>
              <DialogDescription>
                This password is shown only once. Copy it now and share it securely.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <CredentialLine
                label="Login"
                value={result.login}
                onCopy={() => copy(result.login, "Login")}
              />
              <CredentialLine
                label="Temporary password"
                value={result.password}
                onCopy={() => copy(result.password, "Password")}
              />
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialLine({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        <code className="flex-1 break-all rounded bg-secondary p-2">{value || "—"}</code>
        <Button type="button" variant="outline" onClick={onCopy} aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
