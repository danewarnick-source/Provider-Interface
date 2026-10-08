// Data and actions for the Must-knows card: who approved the current text,
// Nectar's draft (held in memory until a person approves), the approve, and
// the manual save of special_directions.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  approveClientMustKnows,
  draftClientMustKnows,
  getClientMustKnows,
} from "@/lib/clients/must-knows.functions";
import { updateClient } from "@/lib/clients/writes.functions";
import type { MustKnowItem, MustKnowsDraft } from "@/lib/clients/must-knows";

export function useMustKnows(orgId: string, clientId: string) {
  const qc = useQueryClient();
  const scope = { organizationId: orgId, clientId };
  const key = ["client-must-knows", orgId, clientId];
  const getFn = useServerFn(getClientMustKnows);
  const draftFn = useServerFn(draftClientMustKnows);
  const approveFn = useServerFn(approveClientMustKnows);
  const updateFn = useServerFn(updateClient);
  const [draft, setDraft] = useState<MustKnowsDraft | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["client-profile"] });
    void qc.invalidateQueries({ queryKey: key });
  };

  const view = useQuery({ queryKey: key, queryFn: () => getFn({ data: scope }) });

  const startDraft = useMutation({
    mutationFn: () => draftFn({ data: scope }),
    onSuccess: (d) => setDraft(d),
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (items: MustKnowItem[]) =>
      approveFn({ data: { ...scope, items, basedOn: draft?.basedOn ?? [] } }),
    onSuccess: () => {
      toast.success("Must-knows approved and saved.");
      setDraft(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (value: string) =>
      updateFn({
        data: { ...scope, patch: { special_directions: value.trim() || null } },
      }),
    onSuccess: () => {
      toast.success("Must-knows saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { view, draft, setDraft, startDraft, approve, save };
}
