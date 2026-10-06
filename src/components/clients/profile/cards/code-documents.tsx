// The documents a client's codes add to the Client file: Room and Board
// (HHS), ELS school documents (under 22), EPR informed choice, SJD
// assessment and USOR outreach, and the belongings inventory.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { isAdminLevel } from "@/lib/access/levels";
import { ageOn } from "@/lib/clients/dates";
import { BelongingsInventoryCard } from "@/components/clients/profile/belongings-inventory-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import {
  EprInformedChoiceCard,
  ElsSchoolDocumentationCard,
  RoomBoardAgreementCard,
  type DocRow,
} from "./code-document-cards";
import { SjdAssessmentDocumentationCard } from "./sjd-assessment-card";
import { SjdUsorOutreachCard } from "./sjd-usor-card";

const BELONGINGS = ["HHS", "RHS", "SLH", "PPS"];

/** Earliest service start date on file for a code. */
function firstStart(
  rows: { service_code: string; service_start_date: string | null }[],
  code: string,
) {
  return (
    rows
      .filter((r) => r.service_code.toUpperCase() === code)
      .map((r) => r.service_start_date)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null
  );
}

export function CodeDocuments({
  orgId,
  data,
  onOpenFiles,
}: {
  orgId: string;
  data: ClientProfileData;
  onOpenFiles: () => void;
}) {
  const { data: org } = useCurrentOrg();
  const clientId = data.client.id;
  const codes = data.codes;
  const docsQ = useQuery({
    queryKey: ["client-code-docs", orgId, clientId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("client_documents")
        .select("id, document_type, file_name, storage_path, uploaded_at")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as DocRow[];
    },
  });
  const startsQ = useQuery({
    enabled: codes.includes("EPR") || codes.includes("SJD"),
    queryKey: ["client-code-starts", orgId, clientId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("client_billing_codes")
        .select("service_code, service_start_date")
        .eq("organization_id", orgId)
        .eq("client_id", clientId);
      if (error) throw error;
      return rows ?? [];
    },
  });
  const docs = docsQ.data ?? [];
  const starts = startsQ.data ?? [];
  const age = ageOn(data.client.date_of_birth);
  const showEls = codes.includes("ELS") && (age == null || age < 22);

  return (
    <div className="space-y-4">
      {codes.includes("HHS") && (
        <RoomBoardAgreementCard clientId={clientId} docs={docs} onOpenFiles={onOpenFiles} />
      )}
      {showEls && <ElsSchoolDocumentationCard clientId={clientId} docs={docs} />}
      {codes.includes("EPR") && (
        <EprInformedChoiceCard
          clientId={clientId}
          docs={docs}
          serviceStart={firstStart(starts, "EPR")}
        />
      )}
      {codes.includes("SJD") && (
        <>
          <SjdAssessmentDocumentationCard
            clientId={clientId}
            orgId={orgId}
            docs={docs}
            serviceStart={firstStart(starts, "SJD")}
            isOrgAdmin={isAdminLevel(org?.access.level)}
          />
          <SjdUsorOutreachCard clientId={clientId} orgId={orgId} />
        </>
      )}
      {codes.some((c) => BELONGINGS.includes(c)) && (
        <BelongingsInventoryCard clientId={clientId} clientName={data.name} />
      )}
    </div>
  );
}
