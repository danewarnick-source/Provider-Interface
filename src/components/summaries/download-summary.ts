// Builds the progress summary PDF (with the agency logo when there is one)
// and saves it in the browser.

import { supabase } from "@/integrations/supabase/client";
import type { SummarySourceBundle } from "@/lib/progress-summaries.functions";
import { renderSummaryPdf } from "@/lib/progress-summary-pdf";
import { summaryFilingDestination } from "@/lib/progress-summaries";

export async function downloadSummaryPdf({
  b,
  content,
  finalizerName,
  aiAttested,
  clientName,
  orgName,
}: {
  b: SummarySourceBundle;
  content: string;
  finalizerName: string;
  aiAttested: boolean;
  clientName: string;
  orgName: string | null;
}): Promise<void> {
  const s = b.summary;
  let logoDataUrl: string | null = null;
  if (b.organization.logo_path) {
    try {
      const { data: signed } = await supabase.storage
        .from("org-branding")
        .createSignedUrl(b.organization.logo_path, 60 * 10);
      if (signed?.signedUrl) {
        const res = await fetch(signed.signedUrl);
        const blob = await res.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      logoDataUrl = null;
    }
  }
  const filing = summaryFilingDestination(s.summary_kind, s.service_codes);
  const blob = renderSummaryPdf({
    clientName,
    periodLabel: s.period_label.replace(/-FS$/, ""),
    periodStart: s.period_start,
    periodEnd: s.period_end,
    services: s.service_codes,
    content: s.final_content ?? content,
    finalizedByName: s.finalized_by_name ?? finalizerName,
    finalizedAt: s.finalized_at ?? new Date().toISOString(),
    providerName: b.organization.legal_name || b.organization.name || orgName || "Provider",
    providerAddress: b.organization.address,
    providerPhone: b.organization.phone,
    supportCoordinatorName: b.client.support_coordinator?.name ?? null,
    supportCoordinatorEmail: b.client.support_coordinator?.email ?? null,
    staffNames: b.staffNames,
    logoDataUrl,
    aiReviewAttested: !!(s.ai_review_attested_at || aiAttested),
    filingNote:
      filing === "upi"
        ? "Filing: enter narrative in the state UPI portal, then attest in PI."
        : filing === "support_coordinator"
          ? "Filing: email/send this PDF to the Support Coordinator via your secure channel, then attest in PI."
          : null,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${clientName.replace(/\s+/g, "_")}_${s.period_label}_summary.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
