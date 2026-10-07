// The Evidence pack review for clients (the existing EvidenceQuestionnaire,
// subject 'client'), opened from the Client file when the agency hasn't chosen
// packs yet. Pre-filled with this client's codes; applying saves the packs on
// the client, and other clients follow their codes from then on.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EvidenceQuestionnaire } from "@/components/evidence/evidence-questionnaire";
import {
  applyEvidenceRequirements,
  createEvidenceChecklist,
  upsertEvidenceRequirement,
} from "@/lib/evidence.functions";
import { parseServiceCodeFlags } from "@/lib/evidence/catalog";

type Props = Parameters<typeof EvidenceQuestionnaire>[0];

export function ClientPackReview({
  orgId,
  clientId,
  clientName,
  activeCodes,
  onClose,
  onSaved,
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  activeCodes: readonly string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const applyFn = useServerFn(applyEvidenceRequirements);
  const customFn = useServerFn(upsertEvidenceRequirement);
  const formFn = useServerFn(createEvidenceChecklist);
  const base = { organizationId: orgId, subjectType: "client" as const, subjectIds: [clientId] };
  const done = (message: string) => {
    toast.success(message);
    onSaved();
    onClose();
  };
  const onError = (e: Error) => toast.error(e.message);

  const applyM = useMutation({
    mutationFn: (args: Parameters<Props["onApply"]>[0]) =>
      applyFn({
        data: {
          ...base,
          requirementKeys: args.requirementKeys,
          suggestedKeys: args.suggestedKeys,
          packKeys: args.packKeys,
          optedOutKeys: args.optedOutKeys,
          typeOverrides: args.typeOverrides,
          dueOverrides: args.dueOverrides,
        },
      }),
    onSuccess: () => done("Document packs saved"),
    onError,
  });
  const customM = useMutation({
    mutationFn: (args: Parameters<Props["onApplyCustom"]>[0]) =>
      customFn({
        data: {
          ...base,
          title: args.title,
          evidenceType: args.evidenceType,
          attestationText: args.attestationText,
          description: args.blurb || null,
          due: args.due,
        },
      }),
    onSuccess: () => done("Item added"),
    onError,
  });
  const formM = useMutation({
    mutationFn: (args: Parameters<Props["onCreateForm"]>[0]) =>
      formFn({ data: { ...base, ...args } }),
    onSuccess: () => done("Form created and added"),
    onError,
  });

  return (
    <EvidenceQuestionnaire
      subject="client"
      personName={clientName}
      initialCodes={parseServiceCodeFlags(activeCodes)}
      onClose={onClose}
      onApply={(args) => applyM.mutate(args)}
      onApplyCustom={(args) => customM.mutate(args)}
      onCreateForm={(args) => formM.mutate(args)}
      pending={applyM.isPending || customM.isPending || formM.isPending}
    />
  );
}
