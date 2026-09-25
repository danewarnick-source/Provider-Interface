// Settings → Access & presets → Change history (access_change_log).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listAccessChangeLog, type AccessChangeRow } from "@/lib/access/access.functions";
import { accessKeys } from "./queries";

const TYPE_LABEL: Record<string, string> = {
  member_access: "Access changed",
  preset_created: "Preset created",
  preset_updated: "Preset edited",
  preset_deleted: "Preset deleted",
  executive_grants: "Executive flags",
  invitation: "Invitation",
  role_change: "Role change (old system)",
};

function summary(r: AccessChangeRow): string {
  const d = r.details as Record<string, Record<string, unknown> | unknown>;
  if (r.change_type === "member_access") {
    const b = (d.before ?? {}) as Record<string, unknown>;
    const a = (d.after ?? {}) as Record<string, unknown>;
    return `${b.access_level ?? "?"} → ${a.access_level ?? "?"}, sees ${a.access_scope ?? "?"}`;
  }
  if (r.change_type.startsWith("preset_")) return String(d.name ?? "");
  if (r.change_type === "invitation") return String(d.access_level ?? "");
  if (r.change_type === "role_change") return `${d.previous_role ?? "?"} → ${d.new_role ?? "?"}`;
  return r.legacy ?? "";
}

export function ChangeLogPanel({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(0);
  const fn = useServerFn(listAccessChangeLog);
  const { data, isLoading } = useQuery({
    queryKey: accessKeys.log(orgId, page),
    queryFn: () => fn({ data: { organization_id: orgId, page } }),
  });
  const rows = data?.rows ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading history…</div>
      ) : !rows.length ? (
        <div className="p-6 text-sm text-muted-foreground">No changes recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Change</th>
                <th className="px-4 py-3 text-left">Who</th>
                <th className="px-4 py-3 text-left">By</th>
                <th className="px-4 py-3 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{TYPE_LABEL[r.change_type] ?? r.change_type}</td>
                  <td className="px-4 py-3">{r.target_user_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.changed_by_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{summary(r) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-border p-3">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
        <Button size="sm" variant="outline" disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>Older</Button>
      </div>
    </div>
  );
}
