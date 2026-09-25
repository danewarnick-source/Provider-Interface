import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { onStaffHired } from "@/lib/staff-assignment-hooks.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { StaffProfileIdentity } from "@/components/employees/staff-profile-identity";
import {
  identityDraftFrom,
  loadStaffProfileIdentity,
  memberBelongsToRouteStaff,
  profileBelongsToRouteStaff,
  staffProfileIdentityQueryKey,
  type StaffIdentityDraft,
  type StaffIdentityMember,
  type StaffIdentityProfile,
} from "@/lib/staff-profile-identity";
import { EmployeeScopeFields } from "@/components/employees/employee-scope-fields";
import { AccessSection } from "@/components/access/access-section";
import { loadEmployeeScope, setEmployeeScope } from "@/lib/obligations/scope.functions";
import { employeeScopeFromSnapshot, type EmployeeScopeDraft } from "@/lib/obligations/scope";

export function StaffProfilePanel({
  orgId,
  staffId,
  profile,
  member,
  name,
  onSaved,
}: {
  orgId: string;
  staffId: string;
  profile: StaffIdentityProfile | null;
  member: StaffIdentityMember;
  name: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { canCategory } = useAccess();
  const canEditIdentity = canCategory("staff_roster", "edit");
  const canSeeAccess = canCategory("staff_roster", "view");
  const canEdit = canEditIdentity;

  const hireHookFn = useServerFn(onStaffHired);
  const loadEmployeeScopeFn = useServerFn(loadEmployeeScope);
  const setEmployeeScopeFn = useServerFn(setEmployeeScope);

  const identityQ = useQuery({
    enabled: !!orgId && !!staffId,
    queryKey: staffProfileIdentityQueryKey(orgId, staffId),
    queryFn: () => loadStaffProfileIdentity(supabase, { organizationId: orgId, staffId }),
  });
  const loaded = identityQ.data;
  const routeProfile =
    loaded !== undefined
      ? profileBelongsToRouteStaff(loaded?.profile ?? null, staffId)
        ? (loaded?.profile ?? null)
        : null
      : profileBelongsToRouteStaff(profile, staffId)
        ? profile
        : null;
  const routeMember =
    loaded?.member && memberBelongsToRouteStaff(loaded.member, staffId)
      ? loaded.member
      : memberBelongsToRouteStaff(member, staffId)
        ? member
        : member;

  const employeeScopeQ = useQuery({
    enabled: !!orgId,
    queryKey: ["employee-compliance-scope", orgId],
    queryFn: () => loadEmployeeScopeFn({ data: { organizationId: orgId } }),
  });
  const EMPTY_EMPLOYEE_SCOPE: EmployeeScopeDraft = { scopeGroupId: null, leadGroupId: null };
  const employeeScopeSaved = useMemo(
    () =>
      employeeScopeFromSnapshot(
        staffId,
        employeeScopeQ.data ?? {
          available: false,
          groups: [],
          members: [],
          scopeByStaffId: {},
          leadsByGroupId: {},
        },
      ),
    [staffId, employeeScopeQ.data],
  );

  const [editing, setEditing] = useState(false);
  const [identity, setIdentity] = useState<StaffIdentityDraft>(() =>
    identityDraftFrom(routeProfile, routeMember),
  );
  const [employeeScopeDraft, setEmployeeScopeDraft] =
    useState<EmployeeScopeDraft>(EMPTY_EMPLOYEE_SCOPE);

  useEffect(() => {
    if (editing) return;
    setIdentity(identityDraftFrom(routeProfile, routeMember));
  }, [editing, routeProfile, routeMember, staffId]);

  useEffect(() => {
    if (editing) return;
    setEmployeeScopeDraft(employeeScopeSaved);
  }, [editing, employeeScopeSaved]);

  const startEdit = () => {
    setIdentity(identityDraftFrom(routeProfile, routeMember));
    setEmployeeScopeDraft(employeeScopeSaved);
    setEditing(true);
  };

  const cancel = () => {
    setIdentity(identityDraftFrom(routeProfile, routeMember));
    setEmployeeScopeDraft(employeeScopeSaved);
    setEditing(false);
  };

  const onIdentityChange = (next: StaffIdentityDraft) => setIdentity(next);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (canEditIdentity) {
        const fullName = `${identity.first_name.trim()} ${identity.last_name.trim()}`.trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("profiles")
          .update({
            first_name: identity.first_name.trim() || null,
            last_name: identity.last_name.trim() || null,
            full_name: fullName || null,
            email: identity.email || null,
            phone: identity.phone || null,
            hire_date: identity.hire_date || null,
            start_date: identity.hire_date || null,
            employee_id: identity.employee_id.trim() || null,
          })
          .eq("id", staffId);
        if (error) throw new Error(error.message);

        const { error: jobErr } = await supabase
          .from("organization_members")
          .update({ job_title: identity.job_title.trim() || null })
          .eq("id", routeMember.id)
          .eq("user_id", staffId);
        if (jobErr) throw new Error(jobErr.message);

        const priorHire = routeProfile?.hire_date ?? routeProfile?.start_date ?? "";
        if (identity.hire_date && identity.hire_date !== priorHire) {
          try {
            await hireHookFn({ data: { organizationId: orgId, staffId } });
          } catch (e) {
            console.warn("[obligations] hire auto-assign failed:", e);
          }
        }
      }

      if (
        employeeScopeQ.data?.available &&
        (employeeScopeDraft.scopeGroupId !== employeeScopeSaved.scopeGroupId ||
          employeeScopeDraft.leadGroupId !== employeeScopeSaved.leadGroupId)
      ) {
        const result = await setEmployeeScopeFn({
          data: {
            organizationId: orgId,
            staffId,
            scopeGroupId: employeeScopeDraft.scopeGroupId,
            leadGroupId: employeeScopeDraft.leadGroupId,
          },
        });
        if (!result.ok && result.reason === "not_live") {
          throw new Error("Scope columns are not live yet. Core Soft applies them after merge.");
        }
        if (!result.ok) throw new Error("Could not save scope.");
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: staffProfileIdentityQueryKey(orgId, staffId) });
      qc.invalidateQueries({ queryKey: ["employee-compliance-scope", orgId] });
      onSaved();
    },
    onError: (e) => toast.error(profileSaveErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profile
          </h2>
          {canEdit && !editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              Edit profile
            </Button>
          ) : null}
          {editing ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  {saveMut.isPending ? "Saving…" : "Save profile"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancel} disabled={saveMut.isPending}>
                  Cancel
                </Button>
              </div>
              {saveMut.isError ? (
                <p className="max-w-sm text-right text-sm text-destructive" role="alert">
                  {profileSaveErrorMessage(saveMut.error)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <StaffProfileIdentity
          orgId={orgId}
          staffId={staffId}
          name={name}
          profile={routeProfile}
          member={routeMember}
          editing={editing && canEditIdentity}
          draft={identity}
          onDraftChange={onIdentityChange}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-sm font-semibold">Leads group / Scope</h2>
        {employeeScopeQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading scope…</p>
        ) : (
          <EmployeeScopeFields
            groups={employeeScopeQ.data?.groups ?? []}
            available={!!employeeScopeQ.data?.available}
            editing={editing && canEdit}
            draft={editing ? employeeScopeDraft : employeeScopeSaved}
            onChange={setEmployeeScopeDraft}
          />
        )}
      </section>

      {canSeeAccess ? (
        <section
          id="access"
          className="scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <AccessSection orgId={orgId} staffId={staffId} />
        </section>
      ) : null}
    </div>
  );
}

function profileSaveErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("Unauthorized")) return "You don't have access to change this profile.";
  return safeErrorMessage(error, "Could not save");
}
