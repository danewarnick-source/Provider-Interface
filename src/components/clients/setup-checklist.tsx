// SetupChecklist — coordinator for the Smart Import "done" page checklist.
// Queries, required-to-go-live flags, and submit stay here. Grouped rows and
// shared row UI live in setup-checklist-groups.tsx. Behavior is unchanged.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { clientReadiness, type ReadinessReport } from "@/lib/client-readiness.functions";
import { getClientOnboardingState } from "@/lib/finish-onboarding.functions";
import {
  getClientFieldStates,
  type FieldStateMap,
} from "@/lib/field-confirmations.functions";
import { submitForSetup } from "@/lib/smart-import-review.functions";
import { EVV_SERVICE_CODES } from "@/lib/evv-codes";
import {
  EndOfLifeGroup,
  NectarAsksGroup,
  RequiredToGoLiveGroup,
  type BillingCodeRow,
  type ClientPcsp,
  type SowSupp,
} from "./setup-checklist-groups";

export { ChecklistRow } from "./setup-checklist-groups";

export function SetupChecklist({ clientId, jobId }: { clientId: string; jobId: string }) {
  const qc = useQueryClient();
  const readinessFn = useServerFn(clientReadiness);

  const readinessQ = useQuery({
    queryKey: ["client-readiness", clientId],
    queryFn: () => readinessFn({ data: { clientId } }) as Promise<ReadinessReport>,
  });

  const codesQ = useQuery({
    queryKey: ["client-billing-codes", clientId],
    queryFn: async (): Promise<BillingCodeRow[]> => {
      const { data, error } = await supabase
        .from("client_billing_codes")
        .select("id, service_code, rate_per_unit, annual_unit_authorization")
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
      return (data ?? []) as BillingCodeRow[];
    },
  });

  const clientQ = useQuery({
    queryKey: ["client-setup-checklist-row", clientId],
    queryFn: async (): Promise<ClientPcsp> => {
      const { data, error } = await supabase
        .from("clients")
        .select("pcsp_goals, physical_address, geofence_radius_feet, is_own_guardian, guardian_name")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? {
        pcsp_goals: [], physical_address: null, geofence_radius_feet: null,
        is_own_guardian: null, guardian_name: null,
      }) as ClientPcsp;
    },
  });

  // SOW supplemental — separate columns on clients.
  const sowSuppQ = useQuery({
    queryKey: ["client-sow-supp", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("level_of_need, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_instructions, grievance_acknowledged, grievance_signed_date")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? {}) as SowSupp;
    },
  });

  // SOW required-field gaps (computed server-side by getClientOnboardingState
  // — exactly the same logic the legacy onboarding wizard uses, including the
  // custom-field-backed keys).
  const onbFn = useServerFn(getClientOnboardingState);
  const onbStateQ = useQuery({
    queryKey: ["client-onboarding-state", clientId],
    queryFn: () => onbFn({ data: { clientId } }),
  });

  const fieldStatesFn = useServerFn(getClientFieldStates);
  const fieldStatesQ = useQuery({
    queryKey: ["client-field-states", clientId],
    queryFn: () => fieldStatesFn({ data: { clientId } }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["client-readiness", clientId] });
    qc.invalidateQueries({ queryKey: ["client-billing-codes", clientId] });
    qc.invalidateQueries({ queryKey: ["client-setup-checklist-row", clientId] });
    qc.invalidateQueries({ queryKey: ["client-sow-supp", clientId] });
    qc.invalidateQueries({ queryKey: ["client-onboarding-state", clientId] });
    qc.invalidateQueries({ queryKey: ["client-field-states", clientId] });
    qc.invalidateQueries({ queryKey: ["client-medications", clientId] });
  };

  const readiness = readinessQ.data;
  const codes = codesQ.data ?? [];
  const client = clientQ.data;
  const sowSupp = sowSuppQ.data;

  const evvApplicable = useMemo(() => {
    const current = readiness?.currentCodes ?? [];
    return current.some(
      (c) => EVV_SERVICE_CODES.find((d) => d.code === c.toUpperCase())?.evvLock,
    );
  }, [readiness?.currentCodes]);

  // SOW-required missing keys, photograph excluded (PHI, deferred).
  const sowMissingKeys: string[] = useMemo(() => {
    const keys = (onbStateQ.data?.sowMissingKeys ?? []) as string[];
    return keys.filter((k) => k !== "photograph");
  }, [onbStateQ.data?.sowMissingKeys]);

  if (
    readinessQ.isLoading || codesQ.isLoading || clientQ.isLoading ||
    sowSuppQ.isLoading || onbStateQ.isLoading || fieldStatesQ.isLoading
  ) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading setup checklist…
      </div>
    );
  }
  if (!readiness || !client || !sowSupp || !fieldStatesQ.data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load setup checklist for this client.
      </div>
    );
  }

  const fieldStates: FieldStateMap = fieldStatesQ.data.states;
  const askPass = {
    medications: fieldStates.medications !== "unknown",
    allergies: fieldStates.allergies !== "unknown",
    immunizations: fieldStates.immunizations !== "unknown",
    advanced_directives: fieldStates.advanced_directives !== "unknown",
    court_orders: fieldStates.court_orders !== "unknown",
  };
  const rightsState = fieldStates.rights_restrictions ?? "unknown";

  // Required-row passing flags (Group 1).
  const rowPass = {
    code: readiness.schedulable,
    rates: readiness.billable,
    goals: readiness.goalsPresent,
    staff: readiness.hasStaff,
    guardian: readiness.guardianValid,
    evv: readiness.evvReady,
    sow: sowMissingKeys.length === 0,
    lon: !!sowSupp.level_of_need?.trim(),
    ec2: !!sowSupp.emergency_contact_2_name?.trim(),
    grievance: !!sowSupp.grievance_acknowledged,
    // Rights row passes when answered. The HRC sub-flow is enforced
    // inside the row component itself — the row stays expanded with a
    // visible CTA until artifacts are linked, but it counts as answered
    // so submit isn't blocked indefinitely while artifacts are gathered.
    rights: rightsState !== "unknown",
  };
  const requiredFlags: boolean[] = [
    rowPass.code, rowPass.rates, rowPass.goals, rowPass.staff, rowPass.guardian,
    ...(evvApplicable ? [rowPass.evv] : []),
    rowPass.sow, rowPass.lon, rowPass.ec2, rowPass.grievance,
    askPass.medications, askPass.allergies, askPass.immunizations,
    askPass.advanced_directives, askPass.court_orders,
    rowPass.rights,
  ];
  const allRequiredPass = requiredFlags.every(Boolean);
  const doneCount = requiredFlags.filter(Boolean).length;
  const totalCount = requiredFlags.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Setup checklist</div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Answer everything required to go live, then submit.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">
              {doneCount} of {totalCount} required done
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{pct}%</div>
          </div>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
      </div>

      <RequiredToGoLiveGroup
        clientId={clientId}
        codes={codes}
        client={client}
        sowSupp={sowSupp}
        sowMissingKeys={sowMissingKeys}
        evvApplicable={evvApplicable}
        rowPass={rowPass}
        onChanged={invalidateAll}
      />

      <NectarAsksGroup
        clientId={clientId}
        fieldStates={fieldStates}
        askPass={askPass}
        rightsState={rightsState}
        rightsPassing={rowPass.rights}
        onChanged={invalidateAll}
      />

      <EndOfLifeGroup clientId={clientId} />

      <SubmitFooter jobId={jobId} canSubmit={allRequiredPass} />
    </div>
  );
}

function SubmitFooter({ jobId, canSubmit }: { jobId: string; canSubmit: boolean }) {
  const submitFn = useServerFn(submitForSetup);
  const m = useMutation({
    mutationFn: () => submitFn({ data: { jobId } }),
    onSuccess: () => toast.success("Submitted for setup."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      {!canSubmit && (
        <div className="mr-auto text-xs text-muted-foreground">
          Answer all required items to submit.
        </div>
      )}
      <Button
        disabled={!canSubmit || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Submit for setup
      </Button>
    </div>
  );
}
