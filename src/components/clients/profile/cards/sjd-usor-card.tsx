// SJD monthly USOR outreach verification (Client file section).

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listUpiAttestations, recordUpiAttestation } from "@/lib/upi-attestations.functions";
import { formatPeriodMonthYear } from "@/lib/progress-summaries";
import { formatDate } from "@/lib/clients/dates";
import { Megaphone } from "lucide-react";
import { SectionCard } from "./section-card";

function currentPeriodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function SjdUsorOutreachCard({ clientId, orgId }: { clientId: string; orgId: string }) {
  const qc = useQueryClient();
  const period = currentPeriodLabel();
  const listFn = useServerFn(listUpiAttestations);
  const recordFn = useServerFn(recordUpiAttestation);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["sjd-usor-outreach", orgId, clientId, period],
    queryFn: () => listFn({ data: { organizationId: orgId, kind: "sjd_usor_outreach" } }),
  });
  const current =
    q.data?.find((a) => a.client_id === clientId && a.period_label === period) ?? null;

  const mut = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          organizationId: orgId,
          clientId,
          kind: "sjd_usor_outreach",
          periodLabel: period,
          noteText: note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("USOR outreach verification recorded.");
      qc.invalidateQueries({ queryKey: ["sjd-usor-outreach"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={Megaphone}
      tone="info"
      title={`USOR outreach verification: ${formatPeriodMonthYear(period)}`}
      description="Whether they received USOR outreach this month, and current USOR funding status."
    >
      <div className="space-y-3">
        {current ? (
          <div className="rounded-xl border border-[var(--hive-ok)]/30 bg-[var(--hive-ok-soft)] p-3 text-sm text-[var(--hive-ok-fg)]">
            <div className="font-medium">
              Entered by {current.attested_by_name ?? "staff"} on{" "}
              {formatDate(current.attested_at.slice(0, 10))}
            </div>
            {current.note_text && (
              <div className="mt-1 whitespace-pre-wrap">{current.note_text}</div>
            )}
          </div>
        ) : (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Person received USOR outreach on 8/10; funding status: active and current."
              rows={2}
            />
            <div className="flex justify-end">
              <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                {mut.isPending ? "Saving…" : "Save outreach note"}
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
