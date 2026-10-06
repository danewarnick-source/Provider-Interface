// Earlier rates and dates of one authorization (client_billing_code_rate_history,
// filled by a database trigger whenever the rate or dates change).

import { formatDate } from "@/lib/clients/dates";
import type { RateHistoryEntry } from "@/lib/clients/services-load";

const money = (n: number) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RateHistory({ entries }: { entries: RateHistoryEntry[] }) {
  return (
    <table className="mt-1 w-full text-[11px]">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-0.5 pr-2 font-normal">Rate</th>
          <th className="py-0.5 pr-2 font-normal">Dates</th>
          <th className="py-0.5 pr-2 font-normal">From</th>
          <th className="py-0.5 font-normal">Changed</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((h) => (
          <tr key={h.id} className="border-t">
            <td className="py-0.5 pr-2 tabular-nums">{money(h.rate_per_unit)}</td>
            <td className="py-0.5 pr-2">
              {formatDate(h.effective_start)} – {formatDate(h.effective_end)}
            </td>
            <td className="py-0.5 pr-2">{h.rate_source ?? "—"}</td>
            <td className="py-0.5">{formatDate(h.superseded_at.slice(0, 10))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
