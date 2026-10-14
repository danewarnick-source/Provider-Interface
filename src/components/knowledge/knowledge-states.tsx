import { Loader2 } from "lucide-react";
import { safeErrorMessage } from "@/lib/safe-error-message";

/** A call refused for access reads differently from a failure. */
const REFUSED = /forbidden|only an owner|not a member|insufficient access/i;

export function KnowledgeLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}

export function KnowledgeNoAccess({ need = "view" }: { need?: "view" | "edit" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-sm">
      <p className="font-semibold text-[var(--hive-text)]">
        {need === "edit"
          ? "You can read the Knowledge base but not change it"
          : "You don't have access to the Knowledge base"}
      </p>
      <p className="mt-1 text-muted-foreground">
        It needs {need === "edit" ? "Edit" : "View"} on Agency settings for the whole agency. Ask an
        owner if you need it.
      </p>
    </div>
  );
}

/** What a failed read shows: the plain no-access card, or the reason it failed. */
export function KnowledgeError({ error }: { error: unknown }) {
  const message = safeErrorMessage(error, "Could not load the Knowledge base. Try again.");
  if (REFUSED.test(message)) return <KnowledgeNoAccess />;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)] p-4 text-sm text-[var(--hive-danger-fg)]"
    >
      {message}
    </div>
  );
}
