// Data for the Medications tab: the client's medications (stopped and
// paused included), and the save, status, send, history, upload and print
// calls. Everything goes through the guarded server functions.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listClientMedications,
  listMedicationChanges,
  saveMedication,
  sendMedicationWithClient,
  setMedicationStatus,
  type ClientMedication,
} from "@/lib/medications/meds.functions";
import {
  openMedicationFile,
  printMedicationList,
  uploadMedicationFile,
} from "@/lib/medications/med-files.functions";
import type { MedicationFileKind } from "@/lib/medications/med-files";

export type { ClientMedication };

export const clientMedicationsKey = (clientId: string) => ["client-medications", clientId] as const;

export function useClientMedications(clientId: string) {
  const list = useServerFn(listClientMedications);
  return useQuery({
    queryKey: clientMedicationsKey(clientId),
    queryFn: () => list({ data: { clientId, includeStopped: true } }),
  });
}

function useRefresh(clientId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clientMedicationsKey(clientId) });
    void qc.invalidateQueries({ queryKey: ["medication-changes"] });
  };
}

export function useSaveMedication(clientId: string) {
  const save = useServerFn(saveMedication);
  const refresh = useRefresh(clientId);
  return useMutation({
    mutationFn: (a: { id: string | null; medication: Record<string, unknown> }) =>
      save({ data: { clientId, id: a.id, medication: a.medication } }),
    onSuccess: () => {
      toast.success("Medication saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetMedicationStatus(clientId: string) {
  const set = useServerFn(setMedicationStatus);
  const refresh = useRefresh(clientId);
  return useMutation({
    mutationFn: (a: { id: string; action: "pause" | "resume" | "stop"; reason: string | null }) =>
      set({ data: a }),
    onSuccess: (_r, a) => {
      toast.success(
        a.action === "stop" ? "Stopped." : a.action === "pause" ? "Paused." : "Resumed.",
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendMedication(clientId: string) {
  const send = useServerFn(sendMedicationWithClient);
  const refresh = useRefresh(clientId);
  return useMutation({
    mutationFn: (a: {
      id: string;
      to: string;
      quantity: number;
      receivedBy: string;
      note: string | null;
    }) => send({ data: a }),
    onSuccess: () => {
      toast.success("Recorded.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMedicationChanges(medicationId: string | null) {
  const list = useServerFn(listMedicationChanges);
  return useQuery({
    queryKey: ["medication-changes", medicationId],
    enabled: !!medicationId,
    queryFn: () => list({ data: { medicationId: medicationId as string } }),
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}

export function useMedicationFiles(clientId: string) {
  const upload = useServerFn(uploadMedicationFile);
  const open = useServerFn(openMedicationFile);
  return {
    upload: async (kind: MedicationFileKind, file: File): Promise<string> => {
      const base64 = await toBase64(file);
      const { path } = await upload({
        data: { clientId, kind, fileName: file.name, mime: file.type, base64 },
      });
      return path;
    },
    open: async (path: string) => {
      try {
        const { url } = await open({ data: { clientId, path } });
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't open the file.");
      }
    },
  };
}

/** Builds the medication list PDF and opens it (downloads when pop-ups are blocked). */
export function usePrintMedicationList(clientId: string) {
  const print = useServerFn(printMedicationList);
  return useMutation({
    mutationFn: () => print({ data: { clientId } }),
    onSuccess: ({ pdfBase64, filename }) => {
      const bin = atob(pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (!window.open(url, "_blank", "noopener,noreferrer")) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
