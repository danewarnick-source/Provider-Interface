// One authorization: code, unit type, rate, dates, 1056 number, units used
// vs. left with the pace marker, dollars, and its rate history. Edit and End
// for Billing: Edit holders; nothing here deletes.

import { useState } from "react";
import { AlertTriangle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { UNIT_TYPES, type AuthorizationView } from "@/lib/clients/authorizations";
import { isVariableRateCode } from "@/lib/variable-rate-codes";
import type { RateHistoryEntry } from "@/lib/clients/services-load";
import { money } from "./money";
import { UnitsBar } from "./units-bar";
import { RateHistory } from "./rate-history";

const num = (n: number) => Math.round(n).toLocaleString();

function StateBadge({ v }: { v: AuthorizationView }) {
  if (v.state === "pending")
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-800">
        Waiting on 1056
      </Badge>
    );
  if (v.state === "upcoming")
    return <Badge variant="outline">Starts {formatDate(v.row.service_start_date)}</Badge>;
  if (v.state === "ended")
    return <Badge variant="secondary">Ended {formatDate(v.row.service_end_date)}</Badge>;
  return (
    <Badge variant="outline" className="border-emerald-300 text-emerald-800">
      Current
    </Badge>
  );
}

export function AuthorizationRow({
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
  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="client-authorization-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{row.service_code}</span>
          <StateBadge v={v} />
          <span className="text-xs text-muted-foreground">
            {unitLabel} ·{" "}
            {rate > 0 ? `${money(rate)} per ${v.daily ? "day" : "unit"}` : "no rate on file"}
          </span>
          {noRate && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3 w-3" /> Enter this client's worksheet rate
            </span>
          )}
        </div>
        {canEdit && v.state !== "ended" && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={onEnd}>
              End
            </Button>
          </div>
        )}
        {canEdit && v.state === "ended" && (
          <Button size="sm" variant="ghost" className="h-7" onClick={onEdit}>
            Renew
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {formatDate(row.service_start_date)} –{" "}
        {row.service_end_date ? formatDate(row.service_end_date) : "no end date"}
        {row.authorization_number ? ` · 1056 #${row.authorization_number}` : " · no 1056 number"}
        {row.authorization_approved_on
          ? ` · approved ${formatDate(row.authorization_approved_on)}`
          : ""}
      </p>

      {pace.annual > 0 && v.state !== "pending" ? (
        <div>
          <div className="flex flex-wrap justify-between gap-2 text-xs tabular-nums">
            <span>
              {num(pace.used)} used · <strong>{num(pace.left)} left</strong> of {num(pace.annual)}{" "}
              {v.unitWord}
            </span>
            {v.money && (
              <span className="text-muted-foreground">
                {money(v.money.used)} used · {money(v.money.left)} left of{" "}
                {money(v.money.authorized)}
              </span>
            )}
          </div>
          <UnitsBar pace={pace} />
          {v.state === "current" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {v.perWeekToUseRest != null
                ? `About ${v.perWeekToUseRest.toFixed(1)} ${v.unitWord} a week uses the rest by the end date.`
                : ""}
              {v.runsOutOn ? (
                <span className="ml-1 font-medium text-amber-700">
                  At this pace the {v.unitWord} run out {formatDate(v.runsOutOn)}.
                </span>
              ) : null}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {v.state === "pending"
            ? "Enter the units and rate when the 1056 arrives."
            : "No units on file."}
        </p>
      )}

      {history.length > 0 && (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setShowHistory((s) => !s)}
          >
            <History className="h-3 w-3" /> Rate history ({history.length})
          </button>
          {showHistory && <RateHistory entries={history} />}
        </div>
      )}
    </div>
  );
}
