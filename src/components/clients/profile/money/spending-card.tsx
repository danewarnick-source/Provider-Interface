// The client's own money spent on shifts (client_spending_log), newest first,
// with the total. Staff log entries from the shift workspace; this is the
// office view.

import { ShoppingBag } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { formatMoney, moneyTotal } from "@/lib/clients/money";
import { formatDate } from "@/lib/clients/dates";
import { ReceiptLink, SPENDING_RECEIPTS_BUCKET } from "./receipt-link";
import { useClientSpending } from "./use-client-money";

export function SpendingCard({ orgId, clientId }: { orgId: string; clientId: string }) {
  const q = useClientSpending(orgId, clientId);
  const rows = q.data ?? [];
  const names = useProfileNames(rows.map((r) => r.staff_id).filter((x): x is string => !!x)).data;

  return (
    <SectionCard
      icon={ShoppingBag}
      tone="neutral"
      title="Spending log"
      description={
        rows.length ? (
          <>
            The client's own money spent on shifts, logged by staff. Total shown:{" "}
            <span className="font-mono">{formatMoney(moneyTotal(rows))}</span>
          </>
        ) : (
          "The client's own money spent on shifts, logged by staff."
        )
      }
      testId="client-money-spending"
    >
      <ReadOnlyTable
        loading={q.isLoading}
        empty="No spending logged for this client."
        rows={rows}
        columns={[
          { header: "Date", cell: (r) => formatDate(r.spent_at) },
          {
            header: "Amount",
            cell: (r) => <span className="font-mono">{formatMoney(Number(r.amount))}</span>,
          },
          { header: "For", cell: (r) => r.purpose ?? "—" },
          {
            header: "Team member",
            cell: (r) => (r.staff_id ? (names?.get(r.staff_id) ?? "Team member") : "—"),
          },
          {
            header: "Receipt",
            cell: (r) => <ReceiptLink path={r.receipt_path} bucket={SPENDING_RECEIPTS_BUCKET} />,
          },
        ]}
      />
    </SectionCard>
  );
}
