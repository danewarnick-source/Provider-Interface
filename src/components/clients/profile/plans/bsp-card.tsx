// Behavior support plan upload: for clients receiving behavior consultation
// (BC1–BC3, from us or another agency), or who have one (setup answer).

import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { Brain } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { useLatestDocument } from "./use-latest-document";

const BSP_TYPES = ["bsp", "behavior_support_plan"] as const;

export function BspCard({
  orgId,
  clientId,
  required,
}: {
  orgId: string;
  clientId: string;
  /** BC1–BC3 needs one on file. */
  required: boolean;
}) {
  const doc = useLatestDocument(orgId, clientId, BSP_TYPES);
  return (
    <SectionCard
      icon={Brain}
      tone="ok"
      title="Behavior support plan"
      description={
        required
          ? "Needed because this client receives behavior consultation (BC1–BC3)."
          : "Their behavior support plan, so staff follow the same plan."
      }
    >
      <div data-testid="client-bsp">
        <NectarAsk
          question={doc.data ? "Behavior support plan" : "Upload the current behavior support plan"}
          kind="data_rich_gap"
          clientId={clientId}
          uploadDocumentType="bsp"
          answeredSummary={doc.data ? `On file: ${doc.data.file_name}` : null}
        />
      </div>
    </SectionCard>
  );
}
