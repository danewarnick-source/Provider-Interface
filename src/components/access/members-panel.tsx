// Settings → Access & presets → Members: who has which level/preset and executive flags.
// Invites live on the Team Members roster's Invited view.

import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listTeamAccess,
  setExecutiveGrants,
  type TeamMemberAccess,
} from "@/lib/access/access.functions";
import { LEVEL_LABEL, SCOPE_LABEL } from "@/lib/access/levels";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { accessKeys } from "./queries";

export function MembersPanel({ orgId, isHiveExec }: { orgId: string; isHiveExec: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamAccess);
  const grantFn = useServerFn(setExecutiveGrants);
  const { data: members = [], isLoading } = useQuery({
    queryKey: accessKeys.team(orgId),
    queryFn: () => listFn({ data: { organization_id: orgId } }),
  });

  const grant = useMutation({
    mutationFn: (v: { m: TeamMemberAccess; company_executive: boolean; hive_executive: boolean }) =>
      grantFn({
        data: {
          organization_id: orgId,
          membership_id: v.m.membership_id,
          target_user_id: v.m.user_id,
          company_executive: v.company_executive,
          hive_executive: v.hive_executive,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: accessKeys.team(orgId) });
      qc.invalidateQueries({ queryKey: ["hive-executive"] });
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save")),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">Invites</h3>
            <p className="text-xs text-muted-foreground">
              Send, resend and copy invite links from Team Members. Add team member there builds a
              complete file first.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/team-members" search={{ view: "invited" }}>
            Open invited team members
          </Link>
        </Button>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold">Members ({members.length})</h3>
          <p className="text-xs text-muted-foreground">
            Open a person to change their level, preset, assignments or settings.
          </p>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading members…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Access</th>
                  <th className="px-4 py-3 text-left">Sees</th>
                  <th className="px-4 py-3 text-center">Company Executive</th>
                  <th className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> PI Executive
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.membership_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link
                        to="/dashboard/team-members/$staffId"
                        params={{ staffId: m.user_id }}
                        hash="access"
                        className="font-medium hover:underline"
                      >
                        {m.full_name ?? m.email}
                      </Link>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {LEVEL_LABEL[m.access_level]}
                      {m.preset_name && (
                        <span className="text-muted-foreground"> · {m.preset_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {SCOPE_LABEL[m.access_scope]}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={m.company_executive}
                        disabled={grant.isPending}
                        aria-label={`Company Executive for ${m.email}`}
                        onCheckedChange={(v) =>
                          grant.mutate({
                            m,
                            company_executive: v === true,
                            hive_executive: m.hive_executive,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={m.hive_executive}
                        disabled={!isHiveExec || grant.isPending}
                        aria-label={`PI Executive for ${m.email}`}
                        onCheckedChange={(v) =>
                          grant.mutate({
                            m,
                            company_executive: m.company_executive,
                            hive_executive: v === true,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
