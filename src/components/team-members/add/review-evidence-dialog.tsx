// "Review evidence pack" after Add / Import team members. Opens the EXISTING
// Evidence questionnaire (subject 'staff') for the person or people just added,
// pre-filled by answersForPeople. Everything stays optional; nothing is created
// until the admin clicks Apply.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EvidenceQuestionnaire } from "@/components/evidence/evidence-questionnaire";
import {
  applyEvidenceRequirements,
  createEvidenceChecklist,
  upsertEvidenceRequirement,
} from "@/lib/evidence.functions";
import { loadTeamMemberEvidenceFacts } from "@/lib/team-members/members.functions";
import { answersForPeople } from "@/lib/team-members/evidence-answers";

export function ReviewEvidencePackDialog({
  organizationId,
  userIds,
  onClose,
}: {
  organizationId: string | null;
  /** Empty = closed. */
  userIds: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const factsFn = useServerFn(loadTeamMemberEvidenceFacts);
  const applyFn = useServerFn(applyEvidenceRequirements);
  const customFn = useServerFn(upsertEvidenceRequirement);
  const formFn = useServerFn(createEvidenceChecklist);
  const open = !!organizationId && userIds.length > 0;

  const factsQ = useQuery({
    enabled: open,
    queryKey: ["team-member-evidence-facts", organizationId, userIds],
    queryFn: () => factsFn({ data: { organizationId: organizationId!, userIds } }),
  });

  const people = factsQ.data?.people ?? [];
  const answers = useMemo(
    () => (factsQ.data ? answersForPeople(factsQ.data.people, factsQ.data.caseload) : null),
    [factsQ.data],
  );
  const subjectIds = people.map((p) => p.userId);
  const single = people.length === 1 ? people[0] : null;
  const hireDate = single?.hireDate ?? null;

  const done = (message: string) => {
    toast.success(message);
    void qc.invalidateQueries({ queryKey: ["evidence-board", organizationId] });
    onClose();
  };
  const onError = (e: Error) => toast.error(e.message);

  const applyM = useMutation({
    mutationFn: (args: Parameters<Parameters<typeof EvidenceQuestionnaire>[0]["onApply"]>[0]) =>
      applyFn({
        data: {
          organizationId: organizationId!,
          subjectType: "staff",
          subjectIds,
          requirementKeys: args.requirementKeys,
          suggestedKeys: args.suggestedKeys,
          packKeys: args.packKeys,
          optedOutKeys: args.optedOutKeys,
          typeOverrides: args.typeOverrides,
          dueOverrides: args.dueOverrides,
        },
      }),
    onSuccess: (res) =>
      done(
        `Applied ${res.count} evidence row${res.count === 1 ? "" : "s"}.` +
          ("skipped" in res && res.skipped
            ? ` ${res.skipped} unchecked row(s) saved as skipped.`
            : ""),
      ),
    onError,
  });
  const customM = useMutation({
    mutationFn: (
      args: Parameters<Parameters<typeof EvidenceQuestionnaire>[0]["onApplyCustom"]>[0],
    ) =>
      customFn({
        data: {
          organizationId: organizationId!,
          subjectType: "staff",
          subjectIds,
          title: args.title,
          evidenceType: args.evidenceType,
          attestationText: args.attestationText,
          due: args.due,
          hireDate,
        },
      }),
    onSuccess: () => done("Custom evidence added."),
    onError,
  });
  const formM = useMutation({
    mutationFn: (
      args: Parameters<Parameters<typeof EvidenceQuestionnaire>[0]["onCreateForm"]>[0],
    ) =>
      formFn({
        data: {
          organizationId: organizationId!,
          subjectType: "staff",
          subjectIds,
          title: args.title,
          description: args.description,
          questions: args.questions,
          due: args.due,
          hireDate,
        },
      }),
    onSuccess: () => done("Form created and added."),
    onError,
  });

  if (!open) return null;
  if (factsQ.isError || !answers || !subjectIds.length) {
    const message = factsQ.isError
      ? factsQ.error instanceof Error
        ? factsQ.error.message
        : "Could not load evidence packs."
      : factsQ.data
        ? "No one to review."
        : "Loading evidence packs…";
    const loading = !factsQ.isError && !factsQ.data;
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4"
        role={loading ? "status" : "alertdialog"}
        data-testid="review-evidence-loading"
      >
        <div className="grid gap-3 rounded-xl bg-card px-4 py-3 text-sm shadow">
          <p>{message}</p>
          {!loading && (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <EvidenceQuestionnaire
      key={subjectIds.join(",")}
      subject="staff"
      personName={single ? single.name : `${people.length} people`}
      hireDate={hireDate}
      initialAnswers={answers}
      onClose={onClose}
      onApply={(args) => applyM.mutate(args)}
      onApplyCustom={(args) => customM.mutate(args)}
      onCreateForm={(args) => formM.mutate(args)}
      pending={applyM.isPending || customM.isPending || formM.isPending}
    />
  );
}
