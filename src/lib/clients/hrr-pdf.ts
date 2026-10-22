// The rights restriction (HRR) as a PDF (pdf-lib, the shared layout from
// strategies-pdf-layout.ts): the details, every question's answer, informed
// consent, and the provider admin, support coordinator and Human Rights
// Committee blocks. Pure (no Supabase), node --test.

import { PDFDocument } from "pdf-lib";
import {
  ACCENT,
  MUTED,
  PdfCursor,
  embedFonts,
  factsGrid,
  pdfSafe,
  stampPageNumbers,
  titleBlock,
} from "./strategies-pdf-layout.ts";
import {
  CONSENT_CHECKBOX,
  HRR_QUESTIONS,
  HRR_STATUS_LABEL,
  consentStatement,
  hrrStatus,
  scMethodLabel,
  type RestrictionRecord,
} from "./hrc.ts";

export type HrrPdfContext = {
  provider: string;
  client: string;
  /** user id → display name, for "entered by" / "recorded by". */
  people: ReadonlyMap<string, string>;
};

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
const stamp = (v: string | null | undefined) =>
  v ? `${v.slice(0, 10)} ${v.slice(11, 16)} UTC`.trim() : "";

export type HrrPdfBlock = { heading: string; lines: string[] };

/** The signature blocks as label lines (shared by the PDF and its test). */
export function hrrSignatureBlocks(r: RestrictionRecord, ctx: HrrPdfContext): HrrPdfBlock[] {
  const who = (id: string | null) => (id ? (ctx.people.get(id) ?? "A team member") : "");
  const consentLabel = r.consent_signer_role === "guardian" ? "Guardian" : "Client";
  return [
    {
      heading: "Informed consent",
      lines: r.consent_signer_name
        ? [
            consentStatement(ctx.client),
            `[x] ${CONSENT_CHECKBOX}`,
            `${consentLabel}: ${r.consent_signer_name}`,
            ...(r.consent_client_name ? [`Client: ${r.consent_client_name}`] : []),
            `Entered by ${who(r.consent_by)} on ${stamp(r.consent_at)}`,
          ]
        : ["Not signed yet."],
    },
    {
      heading: "Provider admin",
      lines: r.admin_signer_name
        ? [
            `Signed: ${r.admin_signer_name}`,
            `By ${who(r.admin_signed_by)} on ${stamp(r.admin_signed_at)}`,
          ]
        : ["Not signed yet."],
    },
    {
      heading: "Support coordinator",
      lines: r.sc_name
        ? [
            `Signed: ${r.sc_name}`,
            `Date signed: ${day(r.sc_signed_on)} (${scMethodLabel(r.sc_method) || "method not recorded"})`,
            `Recorded by ${who(r.sc_recorded_by)} on ${stamp(r.sc_recorded_at)}`,
          ]
        : ["Not signed yet."],
    },
    {
      heading: "Human Rights Committee",
      lines: r.hrc_decision
        ? [
            `Decision: ${r.hrc_decision === "approved" ? "Approved" : "Denied"} on ${day(r.hrc_decision_on)}`,
            `Recorded by ${who(r.hrc_recorded_by)} on ${stamp(r.hrc_recorded_at)}`,
          ]
        : ["No decision recorded yet."],
    },
  ];
}

export function hrrPdfFilename(r: RestrictionRecord, client: string): string {
  const safe = `${client} rights restriction ${r.restriction_title}`
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90);
  return `${safe || "rights-restriction"}.pdf`;
}

export async function renderHrrPdf(r: RestrictionRecord, ctx: HrrPdfContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Rights restriction - ${r.restriction_title} - ${ctx.client}`));
  pdf.setCreator("Provider Interface");
  const fonts = await embedFonts(pdf);
  const c = new PdfCursor(
    pdf,
    fonts,
    `${ctx.provider} · Rights restriction · ${ctx.client} · Confidential`,
  );

  titleBlock(c, ctx.provider, "Rights restriction");
  factsGrid(c, [
    ["Client", ctx.client],
    ["Restriction", r.restriction_title],
    ["Status", HRR_STATUS_LABEL[hrrStatus(r)]],
    ["Still active", r.active ? "Yes" : "No (ended)"],
  ]);

  for (const q of HRR_QUESTIONS) {
    c.gap(6);
    c.ensure(44);
    c.text(q.cite ? `${q.label} (${q.cite})` : q.label, { size: 10.5, bold: true, color: ACCENT });
    c.text(r[q.field]?.trim() || "Not answered.", {
      size: 10,
      color: r[q.field] ? undefined : MUTED,
    });
    if (q.date)
      c.text(`${q.date.label}: ${day(r[q.date.field]) || "Not set"}`, { size: 9, color: MUTED });
  }

  for (const b of hrrSignatureBlocks(r, ctx)) {
    c.gap(10);
    c.rule();
    c.ensure(50);
    c.text(b.heading, { size: 12, bold: true, color: ACCENT, lead: 16 });
    for (const line of b.lines) c.text(line, { size: 10 });
  }

  stampPageNumbers(pdf, fonts.regular);
  return pdf.save();
}
