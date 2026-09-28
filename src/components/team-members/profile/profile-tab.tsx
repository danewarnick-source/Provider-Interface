import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import { useAccess } from "@/hooks/use-access";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { WORKER_TYPES, WORKER_TYPE_LABEL } from "@/lib/team-members/add-member";
import { formatLocalDate, needsTransportSuggestion } from "@/lib/team-members/badges";
import { updateTeamMember } from "@/lib/team-members/members.functions";
import {
  buildTeamMemberPatch,
  draftFromProfile,
  patchIsEmpty,
  type ProfileDraft,
  type TeamMemberProfileData,
} from "@/lib/team-members/profile";
import { AccessSection } from "@/components/access/access-section";
import { StaffPhotoCard } from "@/components/team-members/profile/photo-card";

const NONE = "__none__";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{children || "—"}</div>
    </div>
  );
}

function EditField({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

const money = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/**
 * Profile tab: Contact, Employment and Access. Contact and Employment share one
 * Edit / Save / Cancel and save through updateTeamMember — the browser never
 * writes to profiles or organization_members.
 */
export function StaffProfilePanel({
  orgId,
  data,
  onSaved,
  onReviewEvidence,
}: {
  orgId: string;
  data: TeamMemberProfileData;
  onSaved: () => void;
  onReviewEvidence: () => void;
}) {
  const { canCategory, isAdminLevel } = useAccess();
  const saveFn = useServerFn(updateTeamMember);
  const canEdit = canCategory("staff_roster", "edit");
  const { viewer } = data;
  const staffId = data.member.userId;

  const saved = useMemo(() => draftFromProfile(data), [data]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(saved);
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [editing, saved]);
  const patch = (p: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...p }));

  const save = useMutation({
    mutationFn: async () => {
      const changes = buildTeamMemberPatch(saved, draft, {
        canEditPay: viewer.canEditPay,
        canEditDateOfBirth: viewer.canEditDateOfBirth,
      });
      if (patchIsEmpty(changes)) return false;
      await saveFn({ data: { organizationId: orgId, userId: staffId, ...changes } });
      return true;
    },
    onSuccess: (changed) => {
      toast.success(changed ? "Saved" : "No changes to save");
      setEditing(false);
      onSaved();
    },
    onError: (e) => toast.error(saveErrorMessage(e)),
  });

  const view = editing ? draft : saved;
  const homeName = (id: string) => data.options.homes.find((h) => h.id === id)?.name ?? "";
  const supervisorName = (id: string) =>
    data.options.supervisors.find((s) => s.memberId === id)?.name ??
    data.member.supervisorName ??
    "";
  const staffTypeLabels = view.staffTypeKeys
    .map((k) => data.options.staffTypes.find((t) => t.key === k)?.label ?? k)
    .join(", ");
  // The questionnaire pre-fills from the saved profile, so Review saves first.
  const showTransportSuggestion =
    canCategory("staff_hiring", "edit") &&
    needsTransportSuggestion(draft.transportsClients, data.evidence.items);

  const editActions = canEdit ? (
    editing ? (
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
        </div>
        {save.isError ? (
          <p className="max-w-sm text-right text-sm text-destructive" role="alert">
            {saveErrorMessage(save.error)}
          </p>
        ) : null}
      </div>
    ) : (
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        Edit
      </Button>
    )
  ) : null;

  const grid = "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2";

  return (
    <div className="space-y-6">
      {editActions ? <div className="flex justify-end">{editActions}</div> : null}
      <div className="space-y-6" data-testid="staff-profile-identity" data-staff-id={staffId}>
        <Card title="Contact">
          {editing ? (
            <div className="space-y-4">
              <StaffPhotoCard
                orgId={orgId}
                staffId={staffId}
                name={data.profile.displayName}
                photoPath={draft.photoPath}
                editing
                onChange={(photoPath) => patch({ photoPath })}
              />
              <div className={grid}>
                <EditField label="First name" id="pf-first">
                  <Input
                    id="pf-first"
                    value={draft.firstName}
                    onChange={(e) => patch({ firstName: e.target.value })}
                  />
                </EditField>
                <EditField label="Last name" id="pf-last">
                  <Input
                    id="pf-last"
                    value={draft.lastName}
                    onChange={(e) => patch({ lastName: e.target.value })}
                  />
                </EditField>
                <EditField label="Phone" id="pf-phone">
                  <Input
                    id="pf-phone"
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </EditField>
                <EditField label="Email (sign-in)" id="pf-email">
                  <Input
                    id="pf-email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </EditField>
                <div className="sm:col-span-2">
                  <EditField label="Home address" id="pf-address">
                    <Textarea
                      id="pf-address"
                      rows={2}
                      value={draft.homeAddress}
                      onChange={(e) => patch({ homeAddress: e.target.value })}
                    />
                  </EditField>
                </div>
                <EditField label="Emergency contact name" id="pf-ec-name">
                  <Input
                    id="pf-ec-name"
                    value={draft.emergencyContactName}
                    onChange={(e) => patch({ emergencyContactName: e.target.value })}
                  />
                </EditField>
                <EditField label="Emergency contact relationship" id="pf-ec-rel">
                  <Input
                    id="pf-ec-rel"
                    value={draft.emergencyContactRelationship}
                    onChange={(e) => patch({ emergencyContactRelationship: e.target.value })}
                  />
                </EditField>
                <EditField label="Emergency contact phone" id="pf-ec-phone">
                  <Input
                    id="pf-ec-phone"
                    type="tel"
                    value={draft.emergencyContactPhone}
                    onChange={(e) => patch({ emergencyContactPhone: e.target.value })}
                  />
                </EditField>
                {viewer.canSeeDateOfBirth ? (
                  <EditField label="Date of birth" id="pf-dob">
                    <Input
                      id="pf-dob"
                      type="date"
                      value={draft.dateOfBirth}
                      disabled={!viewer.canEditDateOfBirth}
                      onChange={(e) => patch({ dateOfBirth: e.target.value })}
                    />
                  </EditField>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={grid}>
              <Field label="Phone">{view.phone}</Field>
              <Field label="Email (sign-in)">{view.email}</Field>
              <div className="sm:col-span-2">
                <Field label="Home address">
                  {view.homeAddress ? (
                    <span className="whitespace-pre-line">{view.homeAddress}</span>
                  ) : (
                    ""
                  )}
                </Field>
              </div>
              <Field label="Emergency contact">
                {[view.emergencyContactName, view.emergencyContactRelationship]
                  .filter(Boolean)
                  .join(" · ")}
              </Field>
              <Field label="Emergency contact phone">{view.emergencyContactPhone}</Field>
              {viewer.canSeeDateOfBirth ? (
                <Field label="Date of birth">{formatLocalDate(view.dateOfBirth)}</Field>
              ) : null}
            </div>
          )}
        </Card>

        <Card title="Employment">
          <div className={grid}>
            {editing ? (
              <EditField label="Job title" id="pf-job">
                <Input
                  id="pf-job"
                  value={draft.jobTitle}
                  onChange={(e) => patch({ jobTitle: e.target.value })}
                />
              </EditField>
            ) : (
              <Field label="Job title">{view.jobTitle}</Field>
            )}
            <Field label="Preset">
              <span className="flex flex-wrap items-center gap-2">
                <span>{data.member.presetName ?? "—"}</span>
                <a
                  href={isAdminLevel ? "#access" : "/dashboard/settings/team-access"}
                  className="text-xs text-primary hover:underline"
                >
                  Change in Access
                </a>
              </span>
            </Field>
            {editing ? (
              <EditField label="Home">
                <Select
                  value={draft.homeId || NONE}
                  onValueChange={(v) => patch({ homeId: v === NONE ? "" : v })}
                >
                  <SelectTrigger aria-label="Home">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {data.options.homes.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>
            ) : (
              <Field label="Home">
                {view.homeId ? (data.profile.homeName ?? homeName(view.homeId)) : ""}
              </Field>
            )}
            {editing ? (
              <EditField label="Supervisor">
                <Select
                  value={draft.supervisorMemberId || NONE}
                  onValueChange={(v) => patch({ supervisorMemberId: v === NONE ? "" : v })}
                >
                  <SelectTrigger aria-label="Supervisor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {data.options.supervisors.map((s) => (
                      <SelectItem key={s.memberId} value={s.memberId}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>
            ) : (
              <Field label="Supervisor">
                {view.supervisorMemberId ? supervisorName(view.supervisorMemberId) : ""}
              </Field>
            )}
            {editing ? (
              <EditField label="Hire date" id="pf-hire">
                <Input
                  id="pf-hire"
                  type="date"
                  value={draft.hireDate}
                  onChange={(e) => patch({ hireDate: e.target.value })}
                />
              </EditField>
            ) : (
              <Field label="Hire date">{formatLocalDate(view.hireDate)}</Field>
            )}
            {editing ? (
              <EditField label="Worker type">
                <Select value={draft.workerType} onValueChange={(v) => patch({ workerType: v })}>
                  <SelectTrigger aria-label="Worker type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKER_TYPES.map((w) => (
                      <SelectItem key={w} value={w}>
                        {WORKER_TYPE_LABEL[w]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>
            ) : (
              <Field label="Worker type">
                {WORKER_TYPE_LABEL[view.workerType as keyof typeof WORKER_TYPE_LABEL] ??
                  view.workerType}
              </Field>
            )}
            {editing ? (
              <EditField label="Transports clients">
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Switch
                    checked={draft.transportsClients}
                    onCheckedChange={(v) => patch({ transportsClients: v })}
                    aria-label="Transports clients"
                  />
                  {showTransportSuggestion ? (
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="transport-suggestion"
                    >
                      New suggestion: transport items —{" "}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        disabled={save.isPending}
                        onClick={() => save.mutate(undefined, { onSuccess: onReviewEvidence })}
                      >
                        Review
                      </button>
                    </span>
                  ) : null}
                </div>
              </EditField>
            ) : (
              <Field label="Transports clients">{view.transportsClients ? "Yes" : "No"}</Field>
            )}
            {editing ? (
              <EditField label="Staff type">
                <CheckboxMultiSelect
                  value={draft.staffTypeKeys}
                  onChange={(staffTypeKeys) => patch({ staffTypeKeys })}
                  options={data.options.staffTypes.map((t) => ({ value: t.key, label: t.label }))}
                  placeholder="Choose staff types"
                />
              </EditField>
            ) : (
              <Field label="Staff type">{staffTypeLabels}</Field>
            )}
            {editing ? (
              <EditField label="Team member ID" id="pf-empid">
                <Input
                  id="pf-empid"
                  value={draft.employeeId}
                  onChange={(e) => patch({ employeeId: e.target.value })}
                />
              </EditField>
            ) : (
              <Field label="Team member ID">{view.employeeId}</Field>
            )}
            {viewer.canSeePay ? (
              editing && viewer.canEditPay ? (
                <>
                  <EditField label="Hourly rate" id="pf-hourly">
                    <Input
                      id="pf-hourly"
                      inputMode="decimal"
                      value={draft.hourlyRate}
                      onChange={(e) => patch({ hourlyRate: e.target.value })}
                    />
                  </EditField>
                  <EditField label="Daily rate" id="pf-daily">
                    <Input
                      id="pf-daily"
                      inputMode="decimal"
                      value={draft.dailyRate}
                      onChange={(e) => patch({ dailyRate: e.target.value })}
                    />
                  </EditField>
                </>
              ) : (
                <>
                  <Field label="Hourly rate">{money(data.pay?.hourlyRate)}</Field>
                  <Field label="Daily rate">{money(data.pay?.dailyRate)}</Field>
                </>
              )
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Upcoming time off (next 60 days)">
                {data.timeOff.length ? (
                  <ul className="space-y-0.5" data-testid="profile-time-off">
                    {data.timeOff.map((t) => (
                      <li key={t.id}>
                        {formatLocalDate(t.startDate)}
                        {t.endDate !== t.startDate ? ` – ${formatLocalDate(t.endDate)}` : ""} ·{" "}
                        <span className="capitalize">{t.type.replace(/_/g, " ")}</span>
                        {t.status !== "approved" ? (
                          <span className="text-muted-foreground"> ({t.status})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None"
                )}
              </Field>
            </div>
          </div>
        </Card>
      </div>

      {isAdminLevel ? (
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

function saveErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (/Unauthorized|Forbidden/.test(raw)) return "You don't have access to change this.";
  return safeErrorMessage(error, "Could not save");
}
