// Team (rebuilt in a later step): the team members assigned to this client.

import { CaseloadEditor } from "@/components/clients/shared/caseload-editor";

export function TeamSection({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-4" data-testid="client-section-team">
      <CaseloadEditor clientId={clientId} />
    </div>
  );
}
