import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageShell } from "@/components/layout/page-shell";
import { useCurrentOrg } from "@/hooks/use-org";
import { isPermission, PERMISSION_KEYS, type Permission } from "@/lib/access/permission-keys";
import { CATEGORY_BY_ID, valueLabel } from "@/lib/access/categories";
import { requestAccess } from "@/lib/access/access.functions";

/** "Scheduling: Edit" — the category setting that grants this permission key. */
function neededLabel(perm: Permission): string {
  const rule = PERMISSION_KEYS[perm];
  if (!rule) return "HIVE platform access";
  const cat = CATEGORY_BY_ID[rule[0]];
  return `${cat.label}: ${valueLabel(cat, rule[1])}`;
}

export const Route = createFileRoute("/unauthorized")({
  head: () => ({ meta: [{ title: "Unauthorized — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>): { perm?: Permission; page?: string } => {
    const out: { perm?: Permission; page?: string } = {};
    if (typeof s.perm === "string" && isPermission(s.perm)) out.perm = s.perm;
    if (typeof s.page === "string") out.page = s.page;
    return out;
  },
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const { perm, page } = Route.useSearch();
  const { data: org } = useCurrentOrg();
  const requestFn = useServerFn(requestAccess);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!org || !perm || !reason.trim()) return;
    setSending(true);
    try {
      await requestFn({
        data: { organization_id: org.organization_id, needed: neededLabel(perm), reason: reason.trim(), page },
      });
      setSent(true);
      toast.success("Access request sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--hive-canvas)] px-6">
      <PageShell width="narrow" padding={false} className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {perm ? (
            <>This page needs <strong>{neededLabel(perm)}</strong> access, which your access settings don't include.</>
          ) : (
            "You don't have permission to view this page."
          )}{" "}
          If you believe this is a mistake, contact your agency Owner.
        </p>

        {perm && org && !sent && (
          <div className="mt-6 text-left">
            {!showForm ? (
              <Button className="w-full" onClick={() => setShowForm(true)}>Request access</Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Why do you need this access?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button className="flex-1" disabled={sending || !reason.trim()} onClick={submit}>
                    {sending ? "Sending…" : "Submit request"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {sent && (
          <Alert variant="success" className="mt-6 text-left">
            <AlertDescription>
              Your request has been sent to your organization&apos;s owners.
            </AlertDescription>
          </Alert>
        )}

        <Button asChild variant="outline" className="mt-6"><Link to="/dashboard">Back to dashboard</Link></Button>
      </PageShell>
    </div>
  );
}
