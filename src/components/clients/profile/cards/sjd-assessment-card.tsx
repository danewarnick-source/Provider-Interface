// SJD assessment documentation: Discovery Process or Vocational Assessment,
// its start date and the uploaded assessment (Client file section).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { parseLocalDate } from "@/lib/clients/dates";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { HexMarker, fmtDate } from "./card-shell";
import { DeadlineBanner } from "./deadline-banner";
import type { DocRow } from "./code-document-cards";

type SjdSelection = {
  assessment_type: "discovery_process" | "vocational_assessment";
  assessment_start_date: string | null;
};

export function SjdAssessmentDocumentationCard({
  clientId,
  orgId,
  docs,
  serviceStart,
  isOrgAdmin,
}: {
  clientId: string;
  orgId: string;
  docs: DocRow[];
  serviceStart: string | null;
  isOrgAdmin: boolean;
}) {
  const qc = useQueryClient();
  const writeRecordFn = useServerFn(writeClientRecord);

  const selectionQ = useQuery({
    queryKey: ["sjd-assessment-selection", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sjd_assessment_selections" as never)
        .select("assessment_type, assessment_start_date")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (
        (data as unknown as SjdSelection | null) ?? {
          assessment_type: "discovery_process" as const,
          assessment_start_date: null,
        }
      );
    },
  });

  const selection = selectionQ.data ?? {
    assessment_type: "discovery_process" as const,
    assessment_start_date: null,
  };
  const [startDateDraft, setStartDateDraft] = useState(selection.assessment_start_date ?? "");
  useEffect(() => {
    setStartDateDraft(selection.assessment_start_date ?? "");
  }, [selection.assessment_start_date]);

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<SjdSelection>) => {
      await writeRecordFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "sjd_assessment_selections",
          op: "upsert",
          onConflict: "organization_id,client_id",
          values: {
            assessment_type: patch.assessment_type ?? selection.assessment_type,
            assessment_start_date:
              "assessment_start_date" in patch
                ? patch.assessment_start_date
                : selection.assessment_start_date,
            updated_at: new Date().toISOString(),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["sjd-assessment-selection", orgId, clientId] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isDiscovery = selection.assessment_type === "discovery_process";
  const discoveryDoc = docs.find((d) => d.document_type === "sjd_discovery_assessment");
  const vocationalDoc = docs.find((d) => d.document_type === "sjd_vocational_assessment");

  const serviceStartDate = parseLocalDate(serviceStart);
  const discoveryDue = serviceStartDate
    ? new Date(serviceStartDate.getTime() + 60 * 86_400_000)
    : null;
  const vocationalStart = parseLocalDate(selection.assessment_start_date);
  const vocationalDue = vocationalStart
    ? new Date(vocationalStart.getTime() + 30 * 86_400_000)
    : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">SJD — Assessment Documentation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Discovery Process or Vocational Assessment — only the selected option is tracked.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-md border border-border/60 p-3">
            <Label className="text-xs">Assessment type</Label>
            {isOrgAdmin ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className={isDiscovery ? "font-semibold" : "text-muted-foreground"}>
                  Discovery Process
                </span>
                <Switch
                  checked={!isDiscovery}
                  onCheckedChange={(v) =>
                    saveMut.mutate({
                      assessment_type: v ? "vocational_assessment" : "discovery_process",
                    })
                  }
                  disabled={saveMut.isPending}
                />
                <span className={!isDiscovery ? "font-semibold" : "text-muted-foreground"}>
                  Vocational Assessment
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm">
                {isDiscovery ? "Discovery Process" : "Vocational Assessment"}{" "}
                <span className="text-xs text-muted-foreground">(admin-only to change)</span>
              </p>
            )}
          </div>

          {isDiscovery ? (
            <div className="space-y-3">
              <Label className="text-xs">
                Individualized Strengths-based Job Discovery Assessment
              </Label>
              <DeadlineBanner
                due={discoveryDue}
                doc={discoveryDoc}
                days={60}
                missingHint="No SJD service start date on file — set the SJD authorization's start date to compute the deadline."
              />
              {discoveryDoc ? (
                <NectarAsk
                  question="Individualized Strengths-based Job Discovery Assessment"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_discovery_assessment"
                  answeredSummary={`On file since ${fmtDate(discoveryDoc.uploaded_at)} — ${discoveryDoc.file_name ?? "document"}`}
                />
              ) : (
                <NectarAsk
                  question="Upload the Individualized Strengths-based Job Discovery Assessment"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_discovery_assessment"
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">Assessment start date (admin-entered)</Label>
              {isOrgAdmin ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="w-44"
                    value={startDateDraft}
                    onChange={(e) => setStartDateDraft(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      saveMut.isPending ||
                      startDateDraft === (selection.assessment_start_date ?? "")
                    }
                    onClick={() =>
                      saveMut.mutate({ assessment_start_date: startDateDraft || null })
                    }
                  >
                    Save date
                  </Button>
                </div>
              ) : (
                <p className="text-sm">
                  {selection.assessment_start_date
                    ? fmtDate(selection.assessment_start_date)
                    : "Not set — admin must enter the assessment start date."}
                </p>
              )}
              <Label className="text-xs">Vocational Assessment and Employment Plan</Label>
              <DeadlineBanner
                due={vocationalDue}
                doc={vocationalDoc}
                days={30}
                missingHint="No assessment start date entered yet — an admin must enter it above to compute the deadline."
              />
              {vocationalDoc ? (
                <NectarAsk
                  question="Vocational Assessment and Employment Plan"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_vocational_assessment"
                  answeredSummary={`On file since ${fmtDate(vocationalDoc.uploaded_at)} — ${vocationalDoc.file_name ?? "document"}`}
                />
              ) : (
                <NectarAsk
                  question="Upload the Vocational Assessment and Employment Plan"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_vocational_assessment"
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
