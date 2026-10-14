// Builds the progress summary PDF (progress-summary-pdf.ts, with the agency
// logo when there is one) in the browser and saves it.

import { supabase } from "@/integrations/supabase/client";
import { summaryFileName, type SummaryDoc } from "@/lib/progress-summary-doc";
import { renderSummaryPdf, type PdfLogo } from "@/lib/progress-summary-pdf";

async function loadLogo(path: string | null): Promise<PdfLogo | null> {
  if (!path) return null;
  try {
    const { data } = await supabase.storage.from("org-branding").createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const bytes = new Uint8Array(await (await fetch(data.signedUrl)).arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, type: "png" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: "jpg" };
    return null;
  } catch {
    return null;
  }
}

export async function downloadSummaryPdf({
  doc,
  clientName,
  periodLabel,
  logoPath,
}: {
  doc: SummaryDoc;
  clientName: string;
  periodLabel: string;
  logoPath: string | null;
}): Promise<void> {
  const bytes = await renderSummaryPdf(doc, { clientName, logo: await loadLogo(logoPath) });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = summaryFileName(clientName, periodLabel);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
