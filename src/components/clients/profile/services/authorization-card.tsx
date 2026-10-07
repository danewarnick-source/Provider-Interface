// One open authorization as a card: code and name, dates, 1056 number,
// units used vs. left with the pace marker, rate and dollars, and its rate
// history. Edit and End for Billing: Edit holders; nothing here deletes.

import { useState } from "react";
import { AlertTriangle, History, Receipt } from "lucide-react";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { formatDate } from "@/lib/clients/dates";
import { UNIT_TYPES, type AuthorizationView } from "@/lib/clients/authorizations";
import { isVariableRateCode } from "@/lib/variable-rate-codes";
import type { RateHistoryEntry } from "@/lib/clients/services-load";
import { codeName } from "./code-name";
import { money } from "./money";
import { UnitsBar } from "./units-bar";
import { RateHistory } from "./rate-history";

const num = (n: number) => Math.round(n).toLocaleString();

function StateTag({ v }: { v: AuthorizationView }) {
  if (v.state === "pending") return <StatusTag tone="profile">Waiting on 1056</StatusTag>;
  if (v.state === "upcoming")
    return <StatusTag tone="info">Starts {formatDate(v.row.service_start_date)}</StatusTag>;
  return <StatusTag tone="ok">Current</StatusTag>;
}

export function AuthorizationCard({
  v,
  history,
  canEdit,
  onEdit,
  onEnd,
}: {
  v: AuthorizationView;
  history: RateHistoryEntry[];
  canEdit: boolean;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const { row, pace } = v;
  const rate = Number(row.rate_per_unit ?? 0);
  const unitLabel = UNIT_TYPES[row.unit_type as keyof typeof UNIT_TYPES] ?? row.unit_type;
  const noRate = rate <= 0 && isVariableRateCode(row.service_code);
  const name = codeName(row.service_code);
  return (
    <SectionCard
      icon={Receipt}
      tone={v.state === "current" ? "ok" : v.state === "pending" ? "profile" : "info"}
      title={
        <span>
          <span className="font-mono">{row.service_code}</span>
          {name ? <span className="font-normal"> · {name}</span> : null}
        </span>
      }
      description={
        <>
          {formatDate(row.service_start_date, undefined, "No start date")} –{" "}
          {row.service_end_date ? formatDate(row.service_end_date) : "no end date"}
          {row.authorization_number ? ` · 1056 #${row.authorization_number}` : " · no 1056 number"}
          {row.authorization_approved_on
            ? ` · approved ${formatDate(row.authorization_approved_on)}`
            : ""}
        </>
      }
      testId="client-authorization-row"
      actions={
        <>
          <StateTag v={v} />
          {canEdit ? (
            <>
              <EditButton label={`Edit ${row.service_code} authorization`} onClick={onEdit} />
              <RowMenu
                label={`More actions for ${row.service_code}`}
                items={[{ label: "End authorization", danger: true, onSelect: onEnd }]}
              />
            </>
          ) : null}
        </>
      }
    >
      <div className="space-y-2 text-sm">
        {pace.annual > 0 && v.state !== "pending" ? (
          <div>
            <div className="flex flex-wrap justify-between gap-2 text-xs tabular-nums">
              <span>
                {num(pace.used)} used · <strong>{num(pace.left)} left</strong> of{" "}
                {num(pace.annual)} {v.unitWord}
              </span>
              {v.money ? (
                <span className="text-muted-foreground">
                  {money(v.money.used)} used · {money(v.money.left)} left of{" "}
                  {money(v.money.authorized)}
                </span>
              ) : null}
            </div>
            <UnitsBar pace={pace} />
            {v.state === "current" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {v.perWeekToUseRest != null
                  ? `About ${v.perWeekToUseRest.toFixed(1)} ${v.unitWord} a week uses the rest by the end date.`
                  : ""}
                {v.runsOutOn ? (
                  <span className="ml-1 font-medium text-[var(--hive-danger-fg)]">
                    At this pace the {v.unitWord} run out {formatDate(v.runsOutOn)}.
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {v.state === "pending"
              ? "Enter the units and rate when the 1056 arrives."
              : "No units on file."}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Rate: {rate > 0 ? `${money(rate)} per ${v.daily ? "day" : "unit"}` : "no rate on file"}{" "}
          · {unitLabel}
          {noRate ? (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-[var(--hive-danger-fg)]">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Enter this client's worksheet rate
            </span>
          ) : null}
        </p>
        {history.length > 0 ? (
          <div>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-foreground max-md:min-h-11"
              onClick={() => setShowHistory((s) => !s)}
            >
              <History className="h-3 w-3" aria-hidden />
              {showHistory ? "Hide rate history" : `Show rate history (${history.length})`}
            </button>
            {showHistory ? <RateHistory entries={history} /> : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
