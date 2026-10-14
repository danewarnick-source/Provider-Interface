// Follow-up to the Health setup's medication question: add medications on
// the client's Health → Medications card, or upload the MAR sheet used now.

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { useLatestDocument } from "@/components/clients/profile/plans/use-latest-document";

const MAR_TYPES = ["mar"] as const;

export function MedicationChoices({ orgId, clientId }: { orgId: string; clientId: string }) {
  const mar = useLatestDocument(orgId, clientId, MAR_TYPES);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add their medications under Health → Medications, or upload the MAR sheet you use now.
        </p>
        <Button variant="outline" asChild>
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId }}
            search={{ section: "health" }}
            hash="health-medications"
          >
            Open Medications
          </Link>
        </Button>
      </div>
      <NectarAsk
        question="Upload a MAR sheet"
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="mar"
        answeredSummary={mar.data ? `On file: ${mar.data.file_name}` : null}
      />
    </div>
  );
}
