// Data and actions for the "About <first name>" card: the approved summary,
// Nectar's draft (held in memory until a person approves) and the approve.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  approveClientAboutMe,
  draftClientAboutMe,
  getClientAboutMe,
} from "@/lib/clients/about-me.functions";
import type { AboutDraft, AboutItem } from "@/lib/clients/about-me";

export function useAboutMe(orgId: string, clientId: string) {
  const qc = useQueryClient();
  const scope = { organizationId: orgId, clientId };
  const key = ["client-about-me", orgId, clientId];
  const getFn = useServerFn(getClientAboutMe);
  const draftFn = useServerFn(draftClientAboutMe);
  const approveFn = useServerFn(approveClientAboutMe);
  const [draft, setDraft] = useState<AboutDraft | null>(null);

  const view = useQuery({ queryKey: key, queryFn: () => getFn({ data: scope }) });

  const startDraft = useMutation({
    mutationFn: () => draftFn({ data: scope }),
    onSuccess: (d) => setDraft(d),
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (items: AboutItem[]) =>
      approveFn({
        data: { ...scope, items, basedOn: draft?.basedOn ?? [], draftedByNectar: true },
      }),
    onSuccess: () => {
      toast.success("Summary approved and saved.");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { view, draft, setDraft, startDraft, approve };
}
