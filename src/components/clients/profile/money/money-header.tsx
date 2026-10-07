// The Money header: purpose, "Add transaction" (opens the PBA ledger with
// its form) and tiles for the PBA balance, this month's spending and open
// loans (owners only).

import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { InfoTile } from "@/components/clients/profile/cards/card-parts";
import { formatMoney, isOpenLoan, pbaTone, spentThisMonth } from "@/lib/clients/money";
import { useClientLoans, useClientPba, useClientSpending } from "./use-client-money";

export function MoneyHeader({
  orgId,
  clientId,
  canEdit,
  isOwner,
  onAddTransaction,
}: {
  orgId: string;
  clientId: string;
  canEdit: boolean;
  isOwner: boolean;
  onAddTransaction: () => void;
}) {
  const account = useClientPba(orgId, clientId).data?.account ?? null;
  const spending = useClientSpending(orgId, clientId).data ?? [];
  const loans = useClientLoans(orgId, clientId, isOwner);
  const balance = account ? Number(account.current_balance) : null;
  const openLoans = (loans.loans.data ?? []).filter((l) => isOpenLoan(l.status)).length;
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  return (
    <SectionCard
      icon={Wallet}
      tone="profile"
      title="Money"
      description="Personal funds the agency helps manage."
      testId="client-money-header"
      actions={
        canEdit && account ? (
          <Button onClick={onAddTransaction}>
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        ) : null
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile
          label="PBA balance"
          value={balance == null ? "No PBA account" : formatMoney(balance)}
          note={
            account ? `Medicaid limit ${formatMoney(Number(account.medicaid_threshold))}` : null
          }
          warn={
            !!account &&
            pbaTone(Number(account.current_balance), Number(account.medicaid_threshold)) ===
              "near_limit"
          }
        />
        <InfoTile
          label={`Spent in ${month}`}
          value={formatMoney(spentThisMonth(spending))}
          note="From the spending log"
        />
        {loans.enabled ? (
          <InfoTile
            label="Open loans"
            value={openLoans === 0 ? "None" : String(openLoans)}
            note="Owners only"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
