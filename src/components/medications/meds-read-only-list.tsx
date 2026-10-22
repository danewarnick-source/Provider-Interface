// The client's medications as staff read them on shift: every active,
// not paused medication with its details. Read-only; doses are logged
// elsewhere. Data comes from the care-data read, so a staff member who
// isn't assigned to the client gets no medications back.

import { Pill } from "lucide-react";
import { useClientCareData } from "@/hooks/use-client-care-data";
import { readOnlyMedView } from "@/lib/medications/staff-meds";
import { MedsReadOnlyItem } from "./meds-read-only-item";

export function MedsReadOnlyList({
  clientId,
  serviceCode = null,
  title = "Medications",
  className = "",
}: {
  clientId: string;
  /** The shift's code, so this shares the screen's care-data read. */
  serviceCode?: string | null;
  title?: string;
  className?: string;
}) {
  const care = useClientCareData(clientId, serviceCode);
  const meds = care.data?.visibility.staffCare.medications ?? [];
  return (
    <section
      className={`rounded-xl border border-border bg-card p-4 ${className}`}
      data-testid="meds-read-only-list"
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Pill className="h-4 w-4" /> {title}
      </h2>
      {care.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading medications…</p>
      ) : care.isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load medications.</p>
      ) : meds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No medications to show for this client.</p>
      ) : (
        <ul className="space-y-3">
          {meds.map((m) => (
            <MedsReadOnlyItem key={m.id} med={readOnlyMedView(m)} clientId={clientId} />
          ))}
        </ul>
      )}
    </section>
  );
}
