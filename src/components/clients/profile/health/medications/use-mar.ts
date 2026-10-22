// Data for the MAR tab: one month's grid and doses, the printout, the
// monthly sign-off and reopening, and dose corrections. Everything goes
// through the guarded server functions.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMarMonth,
  printMarMonth,
  reopenMarMonth,
  signOffMarMonth,
} from "@/lib/medications/mar.functions";
import { addEmarAddendum } from "@/lib/emar-pass.functions";
import { openPdfBase64 } from "./use-medications";

export type MarMonth = Awaited<ReturnType<typeof getMarMonth>>;

const marKey = (clientId: string, month: string) => ["mar-month", clientId, month] as const;

export function useMarMonth(clientId: string, month: string) {
  const get = useServerFn(getMarMonth);
  return useQuery({
    queryKey: marKey(clientId, month),
    queryFn: () => get({ data: { clientId, month } }),
  });
}

function useRefresh(clientId: string, month: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: marKey(clientId, month) });
}

export function usePrintMar(clientId: string, month: string) {
  const print = useServerFn(printMarMonth);
  return useMutation({
    mutationFn: () => print({ data: { clientId, month } }),
    onSuccess: ({ pdfBase64, filename }) => openPdfBase64(pdfBase64, filename),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSignOffMar(clientId: string, month: string) {
  const sign = useServerFn(signOffMarMonth);
  const refresh = useRefresh(clientId, month);
  return useMutation({
    mutationFn: (notes: string | null) => sign({ data: { clientId, month, notes } }),
    onSuccess: () => {
      toast.success("Month signed off. The PDF is saved in the client's documents.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReopenMar(clientId: string, month: string) {
  const reopen = useServerFn(reopenMarMonth);
  const refresh = useRefresh(clientId, month);
  return useMutation({
    mutationFn: (reason: string) => reopen({ data: { clientId, month, reason } }),
    onSuccess: () => {
      toast.success("Month reopened.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddCorrection(clientId: string, month: string) {
  const add = useServerFn(addEmarAddendum);
  const refresh = useRefresh(clientId, month);
  return useMutation({
    mutationFn: (a: { logId: string; note: string; reason: string }) => add({ data: a }),
    onSuccess: () => {
      toast.success("Correction added.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
