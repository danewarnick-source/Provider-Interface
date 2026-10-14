import { Loader2 } from "lucide-react";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { isRefusal } from "./use-nectar-admin";

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

function AdminNoAccess() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm">
      <p className="font-semibold text-[var(--hive-text)]">
        You don't have access to Nectar's questions and AI settings
      </p>
      <p className="mt-1 text-muted-foreground">
        They need View on Agency settings for the whole agency. Ask an owner if you need it.
      </p>
    </div>
  );
}

/** What a failed read shows: the plain no-access card, or the reason it failed. */
export function AdminError({ error }: { error: unknown }) {
  if (isRefusal(error)) return <AdminNoAccess />;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)] p-4 text-sm text-[var(--hive-danger-fg)]"
    >
      {safeErrorMessage(error, "Could not load this. Try again.")}
    </div>
  );
}
