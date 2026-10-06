// Services & billing (rebuilt in a later step): authorized codes with
// rates and units, adding a code, and the budget. Needs Billing: View.

import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCodesControl } from "@/components/clients/add/add-codes-control";
import { BillingCodesDetail } from "@/components/clients/profile/billing-codes-detail";
import { ClientBudgetPanel } from "@/components/clients/profile/client-budget-panel";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { displayMedicaidId } from "@/lib/medicaid-id";

const CODE_QUERIES = [
  "client-profile-codes",
  "client-active-codes",
  "client-profile",
  "all-client-billing-codes",
  "client-billing-codes",
  "client-budget",
];

export function ServicesSection({ data }: { data: ClientProfileData }) {
  const qc = useQueryClient();
  const clientId = data.client.id;
  return (
    <div className="space-y-4" data-testid="client-section-services">
      <BillingCodesDetail
        clientId={clientId}
        clientName={data.name}
        medicaidId={displayMedicaidId(data.client.medicaid_id)}
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Add a new authorized code</CardTitle>
        </CardHeader>
        <CardContent>
          <AddCodesControl
            clientId={clientId}
            compact
            onAdded={() => {
              for (const key of CODE_QUERIES) void qc.invalidateQueries({ queryKey: [key] });
            }}
          />
        </CardContent>
      </Card>
      <ClientBudgetPanel clientId={clientId} />
    </div>
  );
}
