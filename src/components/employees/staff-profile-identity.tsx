import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_LABEL, type AccessLevel } from "@/lib/access/levels";
import {
  staffNameParts,
  type StaffIdentityDraft,
  type StaffIdentityMember,
  type StaffIdentityProfile,
} from "@/lib/staff-profile-identity";
import { StaffPhotoCard } from "@/components/staff/staff-photo-card";

export type { StaffIdentityDraft, StaffIdentityMember, StaffIdentityProfile };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value || "—"}</div>
    </div>
  );
}

export function StaffProfileIdentity({
  orgId,
  staffId,
  name,
  profile,
  member,
  editing,
  draft,
  onDraftChange,
}: {
  orgId: string;
  staffId: string;
  name: string;
  profile: StaffIdentityProfile | null;
  member: StaffIdentityMember;
  editing: boolean;
  draft: StaffIdentityDraft;
  onDraftChange: (next: StaffIdentityDraft) => void;
}) {
  const names = staffNameParts(profile);
  const hireDate = profile?.hire_date ?? profile?.start_date ?? "";
  const levelLabel = LEVEL_LABEL[member.access_level as AccessLevel] ?? member.access_level;
  const patch = (partial: Partial<StaffIdentityDraft>) => onDraftChange({ ...draft, ...partial });

  return (
    <div
      className="flex flex-col gap-6 sm:flex-row sm:items-start"
      data-testid="staff-profile-identity"
      data-staff-id={staffId}
    >
      <div className="shrink-0">
        <StaffPhotoCard orgId={orgId} staffId={staffId} name={name} editing={editing} />
      </div>
      <div className="min-w-0 flex-1">
        {!editing ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="First name" value={names.first} />
            <Field label="Last name" value={names.last} />
            <Field label="Email" value={profile?.email} />
            <Field label="Username" value={profile?.username} />
            <Field label="Phone" value={profile?.phone} />
            <Field label="Access level" value={levelLabel} />
            <Field label="Hire date" value={hireDate} />
            <Field label="Employee ID" value={profile?.employee_id} />
            <Field label="Job title" value={member.job_title} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                First name
              </Label>
              <Input
                value={draft.first_name}
                onChange={(e) => patch({ first_name: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Last name
              </Label>
              <Input
                value={draft.last_name}
                onChange={(e) => patch({ last_name: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Username
              </Label>
              <Input type="text" value={profile?.username ?? ""} disabled className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Phone
              </Label>
              <Input
                type="tel"
                value={draft.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                placeholder="(801) 555-0100"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Hire date
              </Label>
              <Input
                type="date"
                value={draft.hire_date}
                onChange={(e) => patch({ hire_date: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Employee ID
              </Label>
              <Input
                value={draft.employee_id}
                onChange={(e) => patch({ employee_id: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Job title
              </Label>
              <Input
                value={draft.job_title}
                onChange={(e) => patch({ job_title: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
