// PDF actions for a client's monthly budget: preview, download, print, and
// "Ship to client file" (a dated snapshot in client_documents). The org logo
// is loaded once, falling back to the org name.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBranding } from "@/components/branding/org-logo";
import {
  budgetPdfFilename,
  renderClientBudgetPdf,
  type BudgetPdfLogo,
  type BudgetPdfPayload,
} from "@/lib/clients/budget-pdf";
import { writeClientRecord } from "@/lib/clients/writes.functions";

export type PdfBusy = null | "download" | "print" | "ship" | "preview";

const monthTag = (iso: string) => iso.slice(0, 7);

function useLogo(organizationId: string): BudgetPdfLogo | null {
  const { data: branding } = useOrgBranding(organizationId);
  const [logo, setLogo] = useState<BudgetPdfLogo | null>(null);
  useEffect(() => {
    let cancelled = false;
    const path = branding?.logo_path;
    if (!path) {
      setLogo(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from("org-branding")
          .createSignedUrl(path, 600);
        if (error || !data?.signedUrl) throw error ?? new Error("no signed url");
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) throw new Error("logo fetch failed");
        const mime =
          resp.headers.get("content-type") || (path.endsWith(".png") ? "image/png" : "image/jpeg");
        const bytes = new Uint8Array(await resp.arrayBuffer());
        if (!cancelled) setLogo({ bytes, mime });
      } catch {
        if (!cancelled) setLogo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branding?.logo_path]);
  return logo;
}

export function useBudgetPdf(args: {
  organizationId: string;
  clientId: string;
  periodMonth: string;
  periodLabel: string;
  clientName: string;
  payload: (logo: BudgetPdfLogo | null) => BudgetPdfPayload;
}) {
  const { organizationId, clientId, periodMonth, periodLabel, clientName } = args;
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const logo = useLogo(organizationId);
  const [busy, setBusy] = useState<PdfBusy>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const shippedQ = useQuery({
    enabled: !!organizationId && !!clientId,
    queryKey: ["client-budget-shipped", clientId, periodMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, uploaded_at")
        .eq("client_id", clientId)
        .eq("document_type", "financial_support_budget")
        .is("archived_at", null)
        .ilike("storage_path", `%/financial-support-${monthTag(periodMonth)}-%`)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function run(mode: Exclude<PdfBusy, null>, work: (bytes: Uint8Array) => Promise<void>) {
    setBusy(mode);
    try {
      await work(await renderClientBudgetPdf(args.payload(logo)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the PDF");
    } finally {
      setBusy(null);
    }
  }
  const blobUrl = (bytes: Uint8Array) =>
    URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));

  const preview = () =>
    run("preview", async (bytes) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(blobUrl(bytes));
    });
  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };
  const open = (mode: "download" | "print") =>
    run(mode, async (bytes) => {
      const url = blobUrl(bytes);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = budgetPdfFilename(clientName, periodLabel);
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (mode === "print") {
        win.addEventListener("load", () => {
          try {
            win.focus();
            win.print();
          } catch {
            /* the browser blocked printing */
          }
        });
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  const ship = () =>
    run("ship", async (bytes) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `${organizationId}/${clientId}/budgets/financial-support-${monthTag(periodMonth)}-${stamp}.pdf`;
      const { error } = await supabase.storage
        .from("client-documents")
        .upload(path, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
          upsert: false,
          contentType: "application/pdf",
        });
      if (error) throw error;
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
      await writeFn({
        data: {
          organizationId,
          clientId,
          table: "client_documents",
          op: "insert",
          values: {
            file_name: `Financial Support — Monthly Budget ${periodLabel}.pdf`,
            document_type: "financial_support_budget",
            file_url: `storage://client-documents/${path}`,
            storage_path: path,
            file_size_bytes: bytes.byteLength,
            uploaded_by: uid,
          },
        },
      });
      toast.success(`Saved to the client file (${periodLabel})`);
      void qc.invalidateQueries({ queryKey: ["client-budget-shipped", clientId, periodMonth] });
      void qc.invalidateQueries({ queryKey: ["client-docs"] });
    });

  return { busy, previewUrl, preview, closePreview, open, ship, shipped: shippedQ.data ?? [] };
}
