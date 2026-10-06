// Behavior support plan upload — shown only for clients receiving behavior
// consultation (BC1–BC3, from us or another agency).

import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { CardShell } from "@/components/clients/profile/cards/card-shell";
import { useLatestDocument } from "./use-latest-document";

const BSP_TYPES = ["bsp", "behavior_support_plan"] as const;

export function BspCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const doc = useLatestDocument(orgId, clientId, BSP_TYPES);
  return (
    <CardShell title="Behavior support plan" subtitle="Needed because this client receives behavior consultation (BC1–BC3).">
      <div data-testid="client-bsp">
        <NectarAsk
          question={doc.data ? "Behavior support plan" : "Upload the current behavior support plan"}
          kind="data_rich_gap"
          clientId={clientId}
          uploadDocumentType="bsp"
          answeredSummary={doc.data ? `On file: ${doc.data.file_name}` : null}
        />
      </div>
    </CardShell>
  );
}
