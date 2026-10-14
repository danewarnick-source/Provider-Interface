/**
 * Client Loan server functions (owner-only).
 *
 * Provider-to-client lending is legally sensitive. The feature is OFF per
 * org by default and only unlocks after an owner records an attestation
 * via `attestLoanFeature`. Every fn requires the Owner level; writes also run
 * the client guard (Loans: Edit, client in this agency and in scope).
 * Nothing is deleted: loans and ledger entries are voided with a reason.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import { cleanVoidReason, VOID_REASON_MAX } from "@/lib/clients/loan-ledger";

export const LOAN_ATTESTATION_VERSION = "draft-2026-06-06-recordkeeping";

export const LOAN_ATTESTATION_TEXT = `DRAFT — pending legal review.

By enabling the Client Loan feature, I (the undersigned administrator)
achnowledge on behalf of my organization that:

1. This is a recordkeeping tool for a financial arrangement the company and
the client's support team have INDEPENDENTLY decided to enter into.

2. PI does not provide legal advice and does not determine whether the
arrangement is permissible. The provider is responsible for verifying
permissibility under their state, DSPD, Medicaid, and rep-payee obligations.

3. The provider confirms the arrangement was entered into voluntarily by the
parties and acknowledges PI's role is limited to documentation and tracking.

4. Any informational material surfaced by NECTAR or the platform is for
review only and is not a legal conclusion. The platform and its operators
are not liable for use of this feature.

I confirm I have authority to make this attestation for my organization.`;

const orgOnly = z.object({ organization_id: z.string().uuid() });
const orgClient = orgOnly.extend({ client_id: z.string().uuid() });

// ─── Settings / attestation ────────────────────────────────────

export const getLoanFeatureStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orgOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return {
        enabled: false,
        settings: null,
        attestations: [],
        currentVersion: LOAN_ATTESTATION_VERSION,
        attestationText: LOAN_ATTESTATION_TEXT,
      };
    }
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    const { data: settings } = await (supabase as any)
      .from("org_loan_settings")
      .select("*")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const { data: attestations } = await (supabase as any)
      .from("org_loan_attestations")
      .select("id, attested_at, attested_by, attestation_version")
      .eq("organization_id", data.organization_id)
      .order("attested_at", { ascending: false })
      .limit(5);
    return {
      enabled: !!settings?.enabled,
      settings: settings ?? null,
      attestations: attestations ?? [],
      currentVersion: LOAN_ATTESTATION_VERSION,
      attestationText: LOAN_ATTESTATION_TEXT,
    };
  });

export const attestLoanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    orgOnly.extend({ accepted: z.literal(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    const { data: att, error: attErr } = await (supabase as any)
      .from("org_loan_attestations")
      .insert({
        organization_id: data.organization_id,
        attested_by: userId,
        attestation_version: LOAN_ATTESTATION_VERSION,
        attestation_text: LOAN_ATTESTATION_TEXT,
      })
      .select()
      .single();
    if (attErr) throw new Error(attErr.message);
    const { error: upErr } = await (supabase as any)
      .from("org_loan_settings")
      .upsert({
        organization_id: data.organization_id,
        enabled: true,
        enabled_at: new Date().toISOString(),
        enabled_by: userId,
        active_attestation_id: att.id,
      });
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const disableLoanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orgOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    await (supabase as any)
      .from("org_loan_settings")
      .upsert({ organization_id: data.organization_id, enabled: false });
    return { ok: true };
  });

// ─── Loans ─────────────────────────────────────────────────────

async function assertEnabled(supabase: any, organization_id: string) {
  const { data } = await supabase
    .from("org_loan_settings")
    .select("enabled")
    .eq("organization_id", organization_id)
    .maybeSingle();
  if (!data?.enabled) throw new Error("Client Loan feature is not enabled for this organization.");
}

const repaymentConditionSchema = z.object({
  id: z.string(),
  label: z.string().max(500),
});

const signaturePartySchema = z.object({
  id: z.string(),
  role: z.string().max(120),
  name: z.string().max(200),
  title: z.string().max(200).optional().nullable(),
});

const loanInput = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  borrower_name: z.string().min(1).max(200),
  lender_name: z.string().min(1).max(200),
  agreement_date: z.string(),
  purpose: z.string().max(2000).optional().nullable(),
  advance_amount: z.number().nullable().optional(),
  advance_cadence: z.string().max(40).nullable().optional(),
  direct_payment_amount: z.number().nullable().optional(),
  direct_payment_cadence: z.string().max(40).nullable().optional(),
  direct_payment_due_day: z.string().max(60).nullable().optional(),
  direct_payment_start_date: z.string().nullable().optional(),
  direct_payment_description: z.string().max(300).nullable().optional(),
  interest_rate: z.number().min(0).max(100).default(0),
  interest_notes: z.string().max(500).nullable().optional(),
  repayment_conditions: z.array(repaymentConditionSchema).default([]),
  maturity_date: z.string().nullable().optional(),
  repayment_method: z.string().max(500).nullable().optional(),
  voluntary_ack: z.boolean().default(true),
  signature_parties: z.array(signaturePartySchema).default([]),
  notes: z.string().max(2000).nullable().optional(),
  status: z.string().default("draft"),
});

export type LoanInput = z.infer<typeof loanInput>;

export const listOrgLoans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orgOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    await assertEnabled(supabase, data.organization_id);
    const { data: rows, error } = await (supabase as any)
      .from("client_loans")
      .select(
        "id, client_id, borrower_name, status, agreement_date, advance_amount, advance_cadence, updated_at, voided_at, void_reason",
      )
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** One client's loan agreements (Money section). Owner-only, like the rest. */
export const listClientLoans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ organization_id: z.string().uuid(), client_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [];
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    await assertEnabled(supabase, data.organization_id);
    const { data: rows, error } = await (supabase as any)
      .from("client_loans")
      .select(
        "id, client_id, borrower_name, status, agreement_date, advance_amount, advance_cadence, updated_at, voided_at, void_reason",
      )
      .eq("organization_id", data.organization_id)
      .eq("client_id", data.client_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getClientLoanMarkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orgOnly.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return [] as { client_id: string; loan_count: number }[];
    // Admin-only; staff never sees these markers.
    try {
      await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    } catch {
      return [] as { client_id: string; loan_count: number }[];
    }
    const { data: rows } = await (supabase as any)
      .from("client_loans")
      .select("client_id")
      .eq("organization_id", data.organization_id)
      .is("voided_at", null);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      counts.set(r.client_id, (counts.get(r.client_id) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([client_id, loan_count]) => ({ client_id, loan_count }));
  });

export const getLoan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: z.string().uuid(), loan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { loan: null, entries: [] };
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    await assertEnabled(supabase, data.organization_id);
    const { data: loan, error } = await (supabase as any)
      .from("client_loans")
      .select("*")
      .eq("id", data.loan_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (error) throw new Error(error.message);
    // Voided entries come back too: the ledger lists them struck through.
    const { data: entries } = await (supabase as any)
      .from("client_loan_entries")
      .select("*")
      .eq("loan_id", data.loan_id)
      .eq("organization_id", data.organization_id)
      .order("entry_date", { ascending: true });
    return { loan, entries: entries ?? [] };
  });

/**
 * Owner level (loan records are owner-only, like their RLS) plus the client
 * guard: Loans: Edit, the client is in this agency, in scope, and not
 * deleted or discharged.
 */
async function guardLoanClient(
  supabase: any,
  userId: string,
  organizationId: string,
  clientId: string,
) {
  await requireOrgMembership(supabase, userId, organizationId, "owner");
  await assertCanManageClient({
    supabase,
    actorId: userId,
    organizationId,
    clientId,
    action: "edit_loans",
  });
}

/** The loan in this agency (throws when it isn't). */
async function loadLoan(
  supabase: any,
  organizationId: string,
  loanId: string,
): Promise<{ id: string; client_id: string; voided_at: string | null }> {
  const { data, error } = await supabase
    .from("client_loans")
    .select("id, client_id, voided_at")
    .eq("id", loanId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Loan not found in this organization");
  return data;
}

const VOIDED_LOAN_MESSAGE = "This loan was voided, so it can't be changed.";

export const upsertLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), values: loanInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return null;
    const orgId = data.values.organization_id;
    await guardLoanClient(supabase, userId, orgId, data.values.client_id);
    await assertEnabled(supabase, orgId);
    if (data.id) {
      const existing = await loadLoan(supabase, orgId, data.id);
      if (existing.client_id !== data.values.client_id) {
        throw new Error("A loan can't be moved to another client.");
      }
      if (existing.voided_at) throw new Error(VOIDED_LOAN_MESSAGE);
      const { data: row, error } = await (supabase as any)
        .from("client_loans")
        .update({ ...data.values })
        .eq("id", data.id)
        .eq("organization_id", orgId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await (supabase as any)
      .from("client_loans")
      .insert({ ...data.values, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const voidInput = z.object({
  organization_id: z.string().uuid(),
  reason: z.string().max(VOID_REASON_MAX),
});

/** Void a loan agreement (kept on file, struck through, with the reason). */
export const voidLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => voidInput.extend({ loan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const reason = cleanVoidReason(data.reason);
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    const loan = await loadLoan(supabase, data.organization_id, data.loan_id);
    await guardLoanClient(supabase, userId, data.organization_id, loan.client_id);
    if (loan.voided_at) return { ok: true };
    const { error } = await (supabase as any)
      .from("client_loans")
      .update({ voided_at: new Date().toISOString(), voided_by: userId, void_reason: reason })
      .eq("id", data.loan_id)
      .eq("organization_id", data.organization_id)
      .is("voided_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Ledger entries ────────────────────────────────────────────

export const addLoanEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      organization_id: z.string().uuid(),
      loan_id: z.string().uuid(),
      entry_date: z.string(),
      kind: z.enum(["advance", "direct_payment", "repayment", "adjustment"]),
      amount: z.number(),
      note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return null;
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    const loan = await loadLoan(supabase, data.organization_id, data.loan_id);
    await guardLoanClient(supabase, userId, data.organization_id, loan.client_id);
    await assertEnabled(supabase, data.organization_id);
    if (loan.voided_at) throw new Error(VOIDED_LOAN_MESSAGE);
    const { data: row, error } = await (supabase as any)
      .from("client_loan_entries")
      .insert({ ...data, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Void one ledger entry: it stays listed (struck through) and leaves the balance. */
export const voidLoanEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => voidInput.extend({ entry_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const reason = cleanVoidReason(data.reason);
    await requireOrgMembership(supabase, userId, data.organization_id, "owner");
    const { data: entry, error: eErr } = await (supabase as any)
      .from("client_loan_entries")
      .select("id, loan_id, voided_at")
      .eq("id", data.entry_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!entry) throw new Error("Ledger entry not found in this organization");
    const loan = await loadLoan(supabase, data.organization_id, entry.loan_id);
    await guardLoanClient(supabase, userId, data.organization_id, loan.client_id);
    if (entry.voided_at) return { ok: true };
    const { error } = await (supabase as any)
      .from("client_loan_entries")
      .update({ voided_at: new Date().toISOString(), voided_by: userId, void_reason: reason })
      .eq("id", data.entry_id)
      .eq("organization_id", data.organization_id)
      .is("voided_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
