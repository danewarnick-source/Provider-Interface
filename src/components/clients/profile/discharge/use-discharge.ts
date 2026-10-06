// Discharge data for the client profile: the open discharge record, the
// preview of what a discharge would end, and the writes. Everything goes
// through lib/clients/discharge.functions.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  dischargeClient,
  draftDischargeSummary,
  getClientDischarge,
  markDischargeSummarySent,
  previewDischarge,
  reactivateClient,
  saveDischargeSummary,
} from "@/lib/clients/discharge.functions";
import type { InitiatedBy } from "@/lib/clients/discharge";

export type DischargeValues = {
  dischargeDate: string;
  reason: string;
  initiatedBy: InitiatedBy | "";
  noticeDate: string;
  summaryText: string;
  summaryDraftedByNectar: boolean;
  summaryConfirmed: boolean;
};

const dischargeKey = (orgId: string, clientId: string) =>
  ["client-discharge", orgId, clientId] as const;

export function useClientDischarge(orgId: string, clientId: string, enabled: boolean) {
  const fn = useServerFn(getClientDischarge);
  return useQuery({
    enabled,
    queryKey: dischargeKey(orgId, clientId),
    queryFn: () => fn({ data: { organizationId: orgId, clientId } }),
  });
}

export function useDischargePreview(
  orgId: string,
  clientId: string,
  dischargeDate: string,
  enabled: boolean,
) {
  const fn = useServerFn(previewDischarge);
  return useQuery({
    enabled: enabled && /^\d{4}-\d{2}-\d{2}$/.test(dischargeDate),
    queryKey: ["client-discharge-preview", orgId, clientId, dischargeDate],
    queryFn: () => fn({ data: { organizationId: orgId, clientId, dischargeDate } }),
  });
}

export function useDraftSummary(orgId: string, clientId: string) {
  const fn = useServerFn(draftDischargeSummary);
  return useMutation({
    mutationFn: (v: { dischargeDate: string; reason: string; initiatedBy: InitiatedBy }) =>
      fn({ data: { organizationId: orgId, clientId, ...v } }),
  });
}

export function useDischargeWrites(orgId: string, clientId: string, onChanged: () => void) {
  const qc = useQueryClient();
  const scope = { organizationId: orgId, clientId };
  const done = () => {
    void qc.invalidateQueries({ queryKey: dischargeKey(orgId, clientId) });
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["client-team"] });
    onChanged();
  };
  const dischargeFn = useServerFn(dischargeClient);
  const summaryFn = useServerFn(saveDischargeSummary);
  const sentFn = useServerFn(markDischargeSummarySent);
  const reactivateFn = useServerFn(reactivateClient);
  return {
    discharge: useMutation({
      mutationFn: (v: DischargeValues) => dischargeFn({ data: { ...scope, ...v } }),
      onSuccess: done,
    }),
    saveSummary: useMutation({
      mutationFn: (v: {
        dischargeId: string;
        text: string;
        draftedByNectar: boolean;
        confirm: boolean;
      }) => summaryFn({ data: { ...scope, ...v } }),
      onSuccess: done,
    }),
    markSent: useMutation({
      mutationFn: (v: { dischargeId: string; sentOn: string }) =>
        sentFn({ data: { ...scope, ...v } }),
      onSuccess: done,
    }),
    reactivate: useMutation({
      mutationFn: () => reactivateFn({ data: scope }),
      onSuccess: done,
    }),
  };
}
