// "Older records" — the team member's old company-obligation file, read-only,
// collapsed at the bottom of the Team member file until the compliance rebuild.
// Loads only when opened. No upload, no override, no status re-derivation:
// it shows what was recorded.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { listStaffObligationInstances } from "@/lib/company-obligations.functions";

const RECORDED_LABEL: Record<string, string> = {
  pending: "Open",
  overdue: "Overdue",
  completed: "Completed",
  waived: "Waived",
};

function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function openObligationFile(path: string): Promise<void> {
  // Open the tab synchronously (inside the click) so pop-up blockers allow it.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage
    .from("obligation-evidence")
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    win?.close();
    throw new Error(error?.message ?? "Could not open file");
  }
  if (win) win.location.href = data.signedUrl;
  else window.open(data.signedUrl, "_blank");
}

export function OlderRecords({
  organizationId,
  staffId,
}: {
  organizationId: string;
  staffId: string;
}) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listStaffObligationInstances);
  const q = useQuery({
    queryKey: ["staff-obligation-files", organizationId, staffId],
    enabled: open,
    queryFn: () => listFn({ data: { organizationId, staffId } }),
  });
  const rows = [...(q.data ?? [])].sort(
    (a, b) =>
      a.obligation.title.localeCompare(b.obligation.title) || b.due_at.localeCompare(a.due_at),
  );

  return (
    <section className="rounded-lg border border-border" data-testid="older-records">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Older records
        <span className="text-xs font-normal text-muted-foreground">
          Read-only — the previous team member file, kept until the compliance rebuild.
        </span>
      </button>
      {open ? (
        <div className="border-t px-3 py-2">
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading older records…</p>
          ) : q.error ? (
            <p className="text-sm text-rose-700">
              {q.error instanceof Error ? q.error.message : "Could not load older records."}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No older records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 text-left">Item</th>
                    <th className="py-1.5 pr-3 text-left">Recorded</th>
                    <th className="py-1.5 pr-3 text-left">Due</th>
                    <th className="py-1.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const path = r.completion?.upload_path ?? r.upload_path ?? null;
                    const filename = r.completion?.upload_filename ?? r.upload_filename ?? null;
                    const title =
                      r.obligation.scope === "staff_per_client" && r.client_name
                        ? r.obligation.title.replace("[Client Name]", r.client_name)
                        : r.obligation.title;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-1.5 pr-3">
                          <p>{title}</p>
                          {filename ? (
                            <p className="text-xs text-muted-foreground">{filename}</p>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-3 text-muted-foreground">
                          {RECORDED_LABEL[r.status] ?? r.status}
                          {r.completion?.completed_at
                            ? ` · ${formatDay(r.completion.completed_at)}`
                            : ""}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pr-3 text-muted-foreground">
                          {formatDay(r.due_at)}
                        </td>
                        <td className="py-1.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!path}
                            onClick={() =>
                              path &&
                              openObligationFile(path).catch((e) =>
                                toast.error(e instanceof Error ? e.message : "Could not open file"),
                              )
                            }
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
