import { clientListCsv, type ClientListRow } from "@/lib/clients/list";
import { todayYmd } from "@/lib/clients/dates";

/** Download the list as shown (current view, search and filters). */
export function downloadClientCsv(rows: ClientListRow[], view: string): void {
  const blob = new Blob([clientListCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clients-${view}-${todayYmd()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
