// SEI / SJD summaries: the monthly attestation that the client's employment
// data was entered in UPI for the summary's period.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatPeriodMonthYear } from "@/lib/progress-summaries";
import { listUpiAttestations, recordUpiAttestation } from "@/lib/upi-attestations.functions";

type SummaryFacts = { service_codes: string[] | null; client_id: string; period_label: string };

function useEmploymentAttestation(organizationId: string, summary: SummaryFacts | null) {
  const qc = useQueryClient();
  const isSei = summary?.service_codes?.includes("SEI") ?? false;
  const isSjd = summary?.service_codes?.includes("SJD") ?? false;
  const empAttestKind = isSjd && !isSei ? "sjd_employment_monthly" : "sei_employment_monthly";
  const listUpiAttestFn = useServerFn(listUpiAttestations);
  const recordUpiAttestFn = useServerFn(recordUpiAttestation);
  const empAttestQ = useQuery({
    enabled: (isSei || isSjd) && !!summary,
    queryKey: [
      "upi-attestations",
      organizationId,
      empAttestKind,
      summary?.client_id,
      summary?.period_label,
    ],
    queryFn: () => listUpiAttestFn({ data: { organizationId, kind: empAttestKind } }),
  });
  const empAttestedAt =
    empAttestQ.data?.find(
      (a) => a.client_id === summary?.client_id && a.period_label === summary?.period_label,
    )?.attested_at ?? null;
  const empAttestMut = useMutation({
    mutationFn: () =>
      recordUpiAttestFn({
        data: {
          organizationId,
          clientId: summary!.client_id,
          kind: empAttestKind,
          periodLabel: summary!.period_label,
        },
      }),
    onSuccess: () => {
      toast.success("Employment data attestation recorded.");
      qc.invalidateQueries({ queryKey: ["upi-attestations"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { isSei, isSjd, empAttestedAt, empAttestMut };
}

export function EmploymentAttestation({
  organizationId,
  summary,
}: {
  organizationId: string;
  summary: SummaryFacts;
}) {
  const { isSei, isSjd, empAttestedAt, empAttestMut } = useEmploymentAttestation(
    organizationId,
    summary,
  );
  if (!isSei && !isSjd) return null;
  return (
    <label className="mt-1 flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={!!empAttestedAt}
        disabled={!!empAttestedAt || empAttestMut.isPending}
        onChange={(e) => {
          if (e.target.checked) empAttestMut.mutate();
        }}
      />
      <span>
        I confirm I have entered this client&apos;s employment data into UPI for{" "}
        {formatPeriodMonthYear(summary.period_label)}.
        {empAttestedAt && (
          <span className="ml-1 text-xs text-muted-foreground">
            Attested {new Date(empAttestedAt).toLocaleDateString()}.
          </span>
        )}
      </span>
    </label>
  );
}
