// Add team member: one person, one screen. Basics, Role (Position + Access),
// DSPD facts and an optional invite. The server generates the password; when no
// invite goes out, it is shown here once. Next step: Review evidence pack.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Copy, ShieldPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  createTeamMember,
  listTeamMemberFormOptions,
  type CreateTeamMemberResult,
} from "@/lib/team-members/members.functions";
import { reactivateMember } from "@/lib/team-members/lifecycle.functions";
import {
  WORKER_TYPES,
  WORKER_TYPE_LABEL,
  defaultStaffPresetId,
  type AccessChoice,
  type WorkerType,
} from "@/lib/team-members/add-member";
import { rosterQueryKey, teamInvitesQueryKey } from "@/lib/team-members/roster";
import { PresetSelect, useAgencyPresets } from "./preset-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckboxMultiSelect } from "@/components/ui/checkbox-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  positions: string[];
  access: AccessChoice | "";
  homeId: string;
  supervisorId: string;
  dateOfBirth: string;
  transportsClients: boolean;
  workerType: WorkerType;
  sendInvite: boolean;
};

function emptyDraft(): Draft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    hireDate: "",
    positions: [],
    access: "",
    homeId: "",
    supervisorId: "",
    dateOfBirth: "",
    transportsClients: false,
    workerType: "w2",
    sendInvite: true,
  };
}

export function formOptionsQueryKey(organizationId: string | null) {
  return ["team-member-form-options", organizationId] as const;
}

export function useTeamMemberFormOptions(organizationId: string | null, enabled: boolean) {
  const fn = useServerFn(listTeamMemberFormOptions);
  return useQuery({
    enabled: !!organizationId && enabled,
    queryKey: formOptionsQueryKey(organizationId),
    queryFn: () => fn({ data: { organizationId: organizationId! } }),
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  organizationId,
  onReviewEvidence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  /** Opens the Evidence questionnaire for the person just added. */
  onReviewEvidence: (userIds: string[]) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createTeamMember);
  const reactivateFn = useServerFn(reactivateMember);
  const { presets, isOwner } = useAgencyPresets(organizationId);
  const optionsQ = useTeamMemberFormOptions(organizationId, open);
  const options = optionsQ.data;

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [result, setResult] = useState<
    (CreateTeamMemberResult & { email: string; sentInvite: boolean }) | null
  >(null);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // Default Access: the DSP preset, once presets load.
  useEffect(() => {
    if (!open || draft.access) return;
    const id = defaultStaffPresetId(presets);
    if (id) setDraft((d) => (d.access ? d : { ...d, access: id }));
  }, [open, presets, draft.access]);

  const reset = () => {
    setDraft(emptyDraft());
    setResult(null);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: rosterQueryKey(organizationId) });
    void qc.invalidateQueries({ queryKey: teamInvitesQueryKey(organizationId) });
    void qc.invalidateQueries({ queryKey: formOptionsQueryKey(organizationId) });
  };

  const createM = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization selected.");
      if (!draft.access) throw new Error("Choose Access.");
      const res = await createFn({
        data: {
          organizationId,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim(),
          hireDate: draft.hireDate,
          dateOfBirth: draft.dateOfBirth,
          access: draft.access,
          positions: draft.positions,
          homeId: draft.homeId || null,
          supervisorId: draft.supervisorId || null,
          workerType: draft.workerType,
          transportsClients: draft.transportsClients,
          sendInvite: draft.sendInvite,
        },
      });
      return { ...res, email: draft.email.trim().toLowerCase(), sentInvite: draft.sendInvite };
    },
    onSuccess: (res) => {
      setResult(res);
      if (res.status === "created") refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateM = useMutation({
    mutationFn: async (userId: string) => {
      if (!organizationId) throw new Error("No organization selected.");
      return reactivateFn({ data: { userId, organizationId } });
    },
    onSuccess: (_res, userId) => {
      toast.success("Reactivated.");
      refresh();
      close();
      void navigate({ to: "/dashboard/team-members/$staffId", params: { staffId: userId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (
      !draft.firstName.trim() ||
      !draft.lastName.trim() ||
      !draft.email.trim() ||
      !draft.hireDate ||
      !draft.access
    ) {
      toast.error("First name, last name, email, hire date and Access are required.");
      return;
    }
    createM.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="add-team-member-dialog"
      >
        {result?.status === "created" ? (
          <CreatedStep
            email={result.email}
            invited={result.invited}
            inviteError={result.sentInvite ? (result.inviteError ?? null) : null}
            tempPassword={result.tempPassword ?? null}
            onReview={() => {
              const id = result.userId;
              close();
              onReviewEvidence([id]);
            }}
            onOpenProfile={() => {
              const id = result.userId;
              close();
              void navigate({ to: "/dashboard/team-members/$staffId", params: { staffId: id } });
            }}
            onAddAnother={reset}
          />
        ) : result?.status === "inactive_match" ? (
          <>
            <DialogHeader>
              <DialogTitle>{result.name} used to work here. Reactivate instead?</DialogTitle>
              <DialogDescription>
                {result.email} is an inactive team member of this agency. Reactivating puts them
                back on the roster with their file, records and history.
              </DialogDescription>
            </DialogHeader>
            {result.rehireEligible === false && (
              <p
                className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                They were marked not eligible for rehire.
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setResult(null)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={reactivateM.isPending}
                className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                onClick={() => reactivateM.mutate(result.userId)}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                {reactivateM.isPending ? "Reactivating…" : "Reactivate"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add team member</DialogTitle>
              <DialogDescription>
                One person. You can review their Evidence pack right after.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Section title="Basics">
                <div className="grid grid-cols-2 gap-3">
                  <Field id="first_name" label="First name" required>
                    <Input
                      id="first_name"
                      value={draft.firstName}
                      onChange={(e) => patch({ firstName: e.target.value })}
                      required
                    />
                  </Field>
                  <Field id="last_name" label="Last name" required>
                    <Input
                      id="last_name"
                      value={draft.lastName}
                      onChange={(e) => patch({ lastName: e.target.value })}
                      required
                    />
                  </Field>
                </div>
                <Field id="email" label="Email (for sign-in)" required>
                  <Input
                    id="email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="phone" label="Phone">
                    <Input
                      id="phone"
                      type="tel"
                      value={draft.phone}
                      onChange={(e) => patch({ phone: e.target.value })}
                    />
                  </Field>
                  <Field id="hire_date" label="Hire date" required>
                    <Input
                      id="hire_date"
                      type="date"
                      value={draft.hireDate}
                      onChange={(e) => patch({ hireDate: e.target.value })}
                      required
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Role">
                <div className="grid gap-2">
                  <Label>Position</Label>
                  <CheckboxMultiSelect
                    value={draft.positions}
                    onChange={(positions) => patch({ positions })}
                    options={(options?.positions ?? []).map((p) => ({
                      value: p.key,
                      label: p.label,
                    }))}
                    placeholder="Choose positions"
                    emptyLabel="No positions set up yet"
                  />
                  <p className="text-xs text-muted-foreground">
                    Their job here. Used to suggest their Evidence pack.
                  </p>
                </div>
                <Field id="access" label="Access" required>
                  <PresetSelect
                    id="access"
                    value={draft.access}
                    onChange={(access) => patch({ access })}
                    presets={presets}
                    isOwner={isOwner}
                  />
                  <p className="text-xs text-muted-foreground">
                    What they can see and do in PI. This isn&apos;t their job — that&apos;s
                    Position.
                  </p>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="home" label="Home">
                    <OptionalSelect
                      id="home"
                      value={draft.homeId}
                      onChange={(homeId) => patch({ homeId })}
                      options={(options?.homes ?? []).map((h) => ({ value: h.id, label: h.name }))}
                    />
                  </Field>
                  <Field id="supervisor" label="Supervisor">
                    <OptionalSelect
                      id="supervisor"
                      value={draft.supervisorId}
                      onChange={(supervisorId) => patch({ supervisorId })}
                      options={(options?.supervisors ?? []).map((s) => ({
                        value: s.memberId,
                        label: s.name,
                      }))}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="DSPD">
                <div className="grid grid-cols-2 gap-3">
                  <Field id="date_of_birth" label="Date of birth">
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={draft.dateOfBirth}
                      onChange={(e) => patch({ dateOfBirth: e.target.value })}
                    />
                  </Field>
                  <Field id="worker_type" label="Worker type">
                    <Select
                      value={draft.workerType}
                      onValueChange={(v) => patch({ workerType: v as WorkerType })}
                    >
                      <SelectTrigger id="worker_type">
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
                  </Field>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span>Transports clients</span>
                  <Switch
                    checked={draft.transportsClients}
                    onCheckedChange={(v) => patch({ transportsClients: v })}
                    aria-label="Transports clients"
                  />
                </label>
              </Section>

              <DialogFooter className="gap-3 sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.sendInvite}
                    onCheckedChange={(v) => patch({ sendInvite: v === true })}
                  />
                  Email an invite now
                </label>
                <Button
                  type="submit"
                  disabled={createM.isPending || !organizationId}
                  className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                >
                  {createM.isPending ? "Adding…" : "Add team member"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function OptionalSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>None</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreatedStep({
  email,
  invited,
  inviteError,
  tempPassword,
  onReview,
  onOpenProfile,
  onAddAnother,
}: {
  email: string;
  invited: boolean;
  inviteError: string | null;
  tempPassword: string | null;
  onReview: () => void;
  onOpenProfile: () => void;
  onAddAnother: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Team member added</DialogTitle>
        <DialogDescription>
          {invited ? `Invite sent to ${email}` : "No invite email went out."}
        </DialogDescription>
      </DialogHeader>
      {inviteError && !invited && (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
          The invite didn&apos;t send: {inviteError}
        </p>
      )}
      {tempPassword && (
        <div className="grid gap-2 rounded-md border border-border p-3" data-testid="temp-password">
          <div className="text-xs text-muted-foreground">
            Temporary password for {email} · shown once
          </div>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-secondary p-2 text-sm">{tempPassword}</code>
            <Button
              type="button"
              variant="outline"
              aria-label="Copy temporary password"
              onClick={() => {
                void navigator.clipboard.writeText(tempPassword);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They will be asked to change it on first sign-in.
          </p>
        </div>
      )}
      <DialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" onClick={onAddAnother}>
          Add another
        </Button>
        <Button type="button" variant="outline" onClick={onOpenProfile}>
          Open profile
        </Button>
        <Button
          type="button"
          className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
          onClick={onReview}
        >
          Review evidence pack
        </Button>
      </DialogFooter>
    </>
  );
}

export function AddTeamMemberButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
      onClick={onClick}
      disabled={disabled}
    >
      <ShieldPlus className="mr-2 h-4 w-4" /> Add team member
    </Button>
  );
}
