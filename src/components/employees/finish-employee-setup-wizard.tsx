import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { finishEmployeeSetup } from "@/lib/employees.functions";
import { createInvitation, resendInvitation } from "@/lib/invitations.functions";
import { interpretInviteSendResult } from "@/lib/invite-send-result";
import { resolveAuthOrigin } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HireDraftFields, type HireDraft } from "@/components/employees/add-employee-wizard";
import { normalizeConfig, type StaffIntakeFieldsConfig } from "@/components/hr/staff-fields-panel";

export type NeedsSetupPerson = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hireDate: string;
  role: HireDraft["role"];
  jobTitle: string;
  department: string;
  employeeId: string;
  workerType: string;
};

type FinishedPerson = {
  userId: string;
  name: string;
  email: string;
  role: HireDraft["role"];
};

function personToDraft(person: NeedsSetupPerson): HireDraft {
  return {
    id: person.userId,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone,
    role: person.role,
    hireDate: person.hireDate,
    staffType: [],
    department: person.department,
    employeeId: person.employeeId,
    workerType: person.workerType,
    customFieldValues: {},
  };
}

export function FinishEmployeeSetupWizard({
  open,
  onOpenChange,
  organizationId,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  people: NeedsSetupPerson[];
}) {
  const qc = useQueryClient();
  const finishFn = useServerFn(finishEmployeeSetup);
  const createInviteFn = useServerFn(createInvitation);
  const resendInviteFn = useServerFn(resendInvitation);
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const [queue, setQueue] = useState<NeedsSetupPerson[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<HireDraft | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [phase, setPhase] = useState<"questions" | "invite">("questions");
  const [finished, setFinished] = useState<FinishedPerson | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = peopleRef.current;
    setQueue(next);
    setIndex(0);
    setPhase("questions");
    setFinished(null);
    const first = next[0];
    setDraft(first ? personToDraft(first) : null);
    setJobTitle(first?.jobTitle ?? "");
  }, [open]);

  useEffect(() => {
    const person = queue[index];
    if (!person || phase === "invite") return;
    setDraft(personToDraft(person));
    setJobTitle(person.jobTitle);
  }, [queue, index, phase]);

  const { data: staffIntakeConfig } = useQuery({
    enabled: !!organizationId && open,
    queryKey: ["staff-intake-fields", organizationId],
    queryFn: async (): Promise<StaffIntakeFieldsConfig> => {
      const { data } = await supabase
        .from("organizations")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("feature_config" as any)
        .eq("id", organizationId!)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc = (data as any)?.feature_config ?? null;
      return normalizeConfig(fc?.staff_intake_fields);
    },
  });

  const person = queue[index] ?? null;
  const atEnd = index + 1 >= queue.length;

  const close = () => onOpenChange(false);

  const advance = () => {
    if (atEnd) {
      close();
      return;
    }
    setFinished(null);
    setPhase("questions");
    setIndex((i) => i + 1);
  };

  const finishMutation = useMutation({
    mutationFn: async (row: HireDraft) => {
      if (!organizationId || !person) throw new Error("No organization selected.");
      return finishFn({
        data: {
          organizationId,
          userId: person.userId,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          email: row.email.trim(),
          phone: row.phone.trim(),
          role: row.role,
          department: row.department,
          hireDate: row.hireDate,
          jobTitle,
          staffType: row.staffType,
          employeeId: row.employeeId,
          workerType: row.workerType,
          customFieldValues: row.customFieldValues,
        },
      });
    },
    onSuccess: (res, row) => {
      toast.success(`${res.name} is set up`);
      setFinished({
        userId: res.userId,
        name: res.name,
        email: res.email,
        role: row.role,
      });
      setPhase("invite");
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteMutation = useMutation({
    mutationFn: async (target: FinishedPerson) => {
      if (!organizationId) throw new Error("No organization selected.");
      const site_origin = resolveAuthOrigin();
      const email = target.email.trim().toLowerCase();
      let raw: unknown;
      try {
        raw = await createInviteFn({
          data: { organization_id: organizationId, email, role: target.role, site_origin },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (!/pending invitation already exists/i.test(msg)) throw e;
        const { data: pending, error } = await supabase
          .from("invitations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("email", email)
          .eq("status", "pending")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!pending?.id) throw e;
        raw = await resendInviteFn({
          data: { organization_id: organizationId, invitation_id: pending.id, site_origin },
        });
      }
      const out = interpretInviteSendResult(raw);
      if (out.rpc_failure) throw new Error(out.message);
      return out.email_sent
        ? `Invite emailed to ${out.email ?? email}.`
        : out.email_error
          ? `Invitation created for ${email}, but the email couldn't be sent (${out.email_error}).`
          : `${email}: ${out.message}`;
    },
    onSuccess: (message) => {
      if (/^Invite emailed/.test(message)) toast.success(message);
      else toast.warning(message);
      qc.invalidateQueries({ queryKey: ["invites"] });
      qc.invalidateQueries({ queryKey: ["invitations"] });
      advance();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!draft || !organizationId) {
      toast.error("No organization selected.");
      return;
    }
    if (
      !draft.firstName.trim() ||
      !draft.lastName.trim() ||
      !draft.email.trim() ||
      !draft.phone.trim() ||
      !draft.hireDate
    ) {
      toast.error("Each person needs a first name, last name, email, phone, and hire date.");
      return;
    }
    finishMutation.mutate(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="finish-setup-dialog"
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {!person || !draft ? (
          <>
            <DialogHeader>
              <DialogTitle>Finish setup</DialogTitle>
              <DialogDescription>No one on the roster is marked Needs setup.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : phase === "questions" ? (
          <>
            <DialogHeader>
              <DialogTitle>Finish setup</DialogTitle>
              <DialogDescription>
                {draft.firstName || draft.lastName
                  ? `${draft.firstName} ${draft.lastName}`.trim()
                  : person.email}{" "}
                · {index + 1} of {queue.length}. Basics are filled in. These are the same questions
                as Add team member. Skip for now leaves them on Needs setup.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="finish-job-title">Job title</Label>
                <Input
                  id="finish-job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <HireDraftFields
                draft={draft}
                index={0}
                showHeader={false}
                canRemove={false}
                staffIntakeConfig={staffIntakeConfig}
                onChange={(patch) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
                onRemove={() => {}}
              />
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (atEnd) {
                      toast.message("Skipped for now. They stay on Needs setup.");
                      close();
                      return;
                    }
                    setIndex((i) => i + 1);
                  }}
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  disabled={finishMutation.isPending || !organizationId}
                  className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                >
                  {finishMutation.isPending ? "Saving…" : "Next"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Send invite?</DialogTitle>
              <DialogDescription>
                {finished?.name ?? "This person"} is set up. Send an invite so they can fill in
                their own details. Nothing is sent unless you choose it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const id = finished?.userId ?? "";
                  close();
                  window.location.href = id
                    ? `/dashboard/evidence?tab=staff&wizard=1&person=${id}`
                    : "/dashboard/evidence?tab=staff&wizard=1";
                }}
              >
                Set up Evidence pack
              </Button>
              <Button type="button" variant="ghost" onClick={advance}>
                {atEnd ? "Done" : "Not now"}
              </Button>
              <Button
                type="button"
                disabled={!finished || inviteMutation.isPending || !organizationId}
                className="bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                onClick={() => {
                  if (finished) inviteMutation.mutate(finished);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                {inviteMutation.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
