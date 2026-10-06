// Profile tab — the SOW §1.10 record at-a-glance.
//
// Read mode = clean label/value rows (no input chrome). Each editable card
// has a pencil that flips it to inputs with Save/Cancel. All writes go to
// real columns documented in the prompt. Custom attributes, EVV, mailing/
// service addresses, and level of need are intentionally absent here.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isRouteUuid } from "@/lib/route-uuid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, Pencil, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ClientPhotoCard } from "@/components/clients/profile/client-photo-card";
import { ClientContactsCard } from "@/components/clients/profile/client-contacts-card";
import { useClientContacts } from "@/components/clients/shared/hooks/use-client-contacts";
import { contactLine, primaryContact } from "@/lib/clients/contacts";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { Textarea } from "@/components/ui/textarea";
import {
  RESTRICTION_ELEMENTS,
  computeRestrictionCompletion,
  type RestrictionRecord,
} from "@/lib/clients/hrc";
import { BelongingsInventoryCard } from "@/components/clients/profile/belongings-inventory-card";
import { listUpiAttestations, recordUpiAttestation } from "@/lib/upi-attestations.functions";
import { formatPeriodMonthYear } from "@/lib/progress-summaries";
import { recordPhiAccess } from "@/lib/phi-access-audit.functions";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { isAdminLevel } from "@/lib/access/levels";
import { ageOn, daysUntil, parseLocalDate } from "@/lib/clients/dates";
import { updateClient, writeClientRecord } from "@/lib/clients/writes.functions";

type ClientRow = Record<string, unknown>;
type DocRow = { id: string; document_type: string | null; file_name: string | null; storage_path: string | null; uploaded_at: string | null };

// Required SOW §1.10 record types surfaced in the completeness bar.
type RecKey =
  | "pcsp" | "photograph" | "grievance_acknowledgment" | "guardian" | "hrc_approval" | "dnr"
  | "grievance_policy" | "individualized_plan" | "room_board_agreement"
  | "els_shortened_school_hours" | "els_iep";
const RECORD_LABELS: Record<RecKey, { title: string; sub: string }> = {
  pcsp: { title: "Person-Centered Plan", sub: "Annual; renews each year" },
  photograph: { title: "Photograph", sub: "No expiration — flagged only when missing" },
  grievance_acknowledgment: { title: "Grievance acknowledgment", sub: "Signed by client / guardian" },
  guardian: { title: "Guardianship docs", sub: "Letter or court order" },
  hrc_approval: { title: "Human Rights / HRC restriction", sub: "Required when rights are restricted or Human Rights applies" },
  dnr: { title: "DNR order", sub: "Required when DNR is on file" },
  grievance_policy: { title: "Grievance policy", sub: "A signed copy on file" },
  individualized_plan: { title: "Individualized plans", sub: "Behavior support / IEP / similar" },
  room_board_agreement: { title: "Room and Board Agreement", sub: "Signed legal doc — HHS only, no expiration" },
  els_shortened_school_hours: { title: "ELS — shortened school hours doc", sub: "School district letter/form — ELS under 22 only" },
  els_iep: { title: "ELS — Individualized Education Plan (IEP)", sub: "ELS under 22 only" },
};

const HRR_FILENAME_RE = /hrr|hrc|human[\s_-]*rights|rights[\s_-]*restriction/i;

export function ClientProfileTab({ clientId, onOpenFiles }: { clientId: string; onOpenFiles: () => void }) {
  const navigate = useNavigate();
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const canHrc = useAccess().canCategory("hrc");

  const clientQ = useQuery({
    enabled: !!orgId && isRouteUuid(clientId),
    queryKey: ["client-profile-tab", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "id, first_name, last_name, medicaid_id, date_of_birth, phone_number, physical_address, is_own_guardian, admission_date, discharge_date, diagnoses, special_directions, dnr_status, account_status, pcsp_expiration_date, rights_restrictions, has_abi, hr_applicable, dnr_applicable, client_photo_url" as any,
        )
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as ClientRow | null;
    },
  });

  const docsQ = useQuery({
    enabled: !!orgId && isRouteUuid(clientId),
    queryKey: ["client-profile-tab-docs", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, document_type, file_name, storage_path, uploaded_at")
        .eq("organization_id", orgId!)
        .eq("client_id", clientId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const restrictionsQ = useQuery({
    enabled: !!orgId && isRouteUuid(clientId),
    queryKey: ["client-restrictions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrc_restriction_records" as never)
        .select("*")
        .eq("client_id", clientId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestrictionRecord[];
    },
  });

  const activeCodesQ = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-tab-codes", orgId, clientId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("client_billing_codes")
        .select("service_code, service_start_date, service_end_date")
        .eq("organization_id", orgId!)
        .eq("client_id", clientId);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ service_code: string; service_start_date: string | null; service_end_date: string | null }>;
      const active = rows.filter((c) => (!c.service_start_date || c.service_start_date <= today) && (!c.service_end_date || c.service_end_date >= today));
      return { codes: active.map((c) => c.service_code.toUpperCase()), rows };
    },
  });

  const client = clientQ.data ?? null;
  const docs = docsQ.data ?? [];
  const restrictions = restrictionsQ.data ?? [];
  const primaryRestriction = restrictions[0] ?? null;
  const activeCodes = activeCodesQ.data?.codes ?? [];
  const isHhs = activeCodes.includes("HHS");
  const showBelongings = activeCodes.some((c) => ["HHS", "RHS", "SLH", "PPS"].includes(c));
  const isEls = activeCodes.includes("ELS");
  const isEpr = activeCodes.includes("EPR");
  const isSjd = activeCodes.includes("SJD");
  const clientAge = age(client?.date_of_birth as string | null | undefined);
  const showElsSchoolDocs = isEls && (clientAge == null || clientAge < 22);
  const eprServiceStart = (activeCodesQ.data?.rows ?? [])
    .filter((r) => r.service_code.toUpperCase() === "EPR")
    .map((r) => r.service_start_date)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;
  const sjdServiceStart = (activeCodesQ.data?.rows ?? [])
    .filter((r) => r.service_code.toUpperCase() === "SJD")
    .map((r) => r.service_start_date)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;
  const isOrgAdmin = isAdminLevel(org?.access.level);

  if (clientQ.isLoading || !client) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <RecordCompletenessBar
        clientId={clientId}
        orgId={orgId!}
        client={client}
        docs={docs}
        restriction={primaryRestriction}
        isHhs={isHhs}
        showElsSchoolDocs={showElsSchoolDocs}
        onOpenFiles={onOpenFiles}
        onContinueIntake={() => navigate({ to: "/dashboard/client-intake/$clientId", params: { clientId } })}
      />

      <ClinicalAlertBanner clientId={clientId} client={client} />

      <div className="grid gap-4 items-start lg:grid-cols-[1.65fr_1fr]">
        <IdentityCard clientId={clientId} client={client} />
        <div className="space-y-4">
          <ClientContactsCard clientId={clientId} />
          <AtGlanceCard clientId={clientId} client={client} />
          {canHrc && (
            <HrcCard clientId={clientId} orgId={orgId!} client={client} docs={docs} restriction={primaryRestriction} />
          )}
          {isHhs && <RoomBoardAgreementCard clientId={clientId} docs={docs} onOpenFiles={onOpenFiles} />}
          {showElsSchoolDocs && <ElsSchoolDocumentationCard clientId={clientId} docs={docs} />}
          {isEpr && <EprInformedChoiceCard clientId={clientId} docs={docs} serviceStart={eprServiceStart} />}
          {isSjd && (
            <SjdAssessmentDocumentationCard
              clientId={clientId}
              orgId={orgId!}
              docs={docs}
              serviceStart={sjdServiceStart}
              isOrgAdmin={isOrgAdmin}
            />
          )}
          {isSjd && <SjdUsorOutreachCard clientId={clientId} orgId={orgId!} />}
        </div>
      </div>

      {showBelongings && (
        <BelongingsInventoryCard clientId={clientId} clientName={`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()} />
      )}

      <RetentionFooter clientId={clientId} status={(client.account_status as string | null) ?? "active"} />
    </div>
  );
}

// ── Room and Board Agreement (HHS only) ─────────────────────────────────────

function RoomBoardAgreementCard({ clientId, docs, onOpenFiles }: { clientId: string; docs: DocRow[]; onOpenFiles: () => void }) {
  const doc = docs.find((d) => d.document_type === "room_board_agreement");
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Room and Board Agreement</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Signed legal doc — no expiration</p>
          </div>
        </div>
        <div className="p-5">
          {doc ? (
            <NectarAsk
              question="Room and Board Agreement"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="room_board_agreement"
              answeredSummary={`On file since ${fmtDate(doc.uploaded_at)} — ${doc.file_name ?? "signed document"}`}
              manualForm={
                <Button size="sm" variant="outline" onClick={onOpenFiles}>View in Files</Button>
              }
            />
          ) : (
            <NectarAsk
              question="Upload the signed Room and Board Agreement"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="room_board_agreement"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── ELS — Extended Living Supports school documentation (under 22) ─────────

function ElsSchoolDocumentationCard({ clientId, docs }: { clientId: string; docs: DocRow[] }) {
  const hoursDoc = docs.find((d) => d.document_type === "els_shortened_school_hours");
  const iepDoc = docs.find((d) => d.document_type === "els_iep");
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Extended Living Supports — School Documentation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">ELS · school-age (under 22) — no expiration, just present or missing</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs">School district documentation — shortened school hours</Label>
            {hoursDoc ? (
              <NectarAsk
                question="School district documentation — shortened school hours"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_shortened_school_hours"
                answeredSummary={`On file since ${fmtDate(hoursDoc.uploaded_at)} — ${hoursDoc.file_name ?? "document"}`}
              />
            ) : (
              <NectarAsk
                question="Upload the school district letter/form confirming shortened school hours"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_shortened_school_hours"
              />
            )}
          </div>
          <div>
            <Label className="text-xs">Individualized Education Plan (IEP)</Label>
            {iepDoc ? (
              <NectarAsk
                question="Individualized Education Plan (IEP)"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_iep"
                answeredSummary={`On file since ${fmtDate(iepDoc.uploaded_at)} — ${iepDoc.file_name ?? "document"}`}
              />
            ) : (
              <NectarAsk
                question="Upload the Individualized Education Plan (IEP)"
                kind="data_rich_gap"
                clientId={clientId}
                uploadDocumentType="els_iep"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── EPR — Informed Choice conversation documentation (60-day deadline) ─────

function EprInformedChoiceCard({ clientId, docs, serviceStart }: { clientId: string; docs: DocRow[]; serviceStart: string | null }) {
  const doc = docs.find((d) => d.document_type === "epr_informed_choice");
  const serviceStartDate = parseLocalDate(serviceStart);
  const dueDate = serviceStartDate ? new Date(serviceStartDate.getTime() + 60 * 86_400_000) : null;
  const dueStr = dueDate ? dueDate.toISOString().slice(0, 10) : null;
  const isOverdue = !doc && !!dueDate && dueDate.getTime() < Date.now();
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">EPR Informed Choice Conversation — Documentation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Must confirm EPR is not permanent, the Person's employment goals, and a plan for after EPR ends.
            </p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {dueStr ? (
            <div className={cn(
              "rounded-md border p-2.5 text-sm font-medium",
              doc ? "border-emerald-300/60 bg-emerald-50/40 text-emerald-800"
                : isOverdue ? "border-red-300 bg-red-50 text-red-700"
                : "border-amber-300/60 bg-amber-50/40 text-amber-800",
            )}>
              {doc ? `Satisfied — deadline was ${fmtDate(dueStr)}` : isOverdue ? `Overdue — was due ${fmtDate(dueStr)} (60 days from EPR start)` : `Due ${fmtDate(dueStr)} — 60 days from EPR service start`}
            </div>
          ) : (
            <div className="rounded-md border border-border p-2.5 text-sm text-muted-foreground">
              No EPR service start date on file — set the EPR authorization's start date to compute the deadline.
            </div>
          )}
          {doc ? (
            <NectarAsk
              question="EPR Informed Choice Conversation — Documentation"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="epr_informed_choice"
              answeredSummary={`On file since ${fmtDate(doc.uploaded_at)} — ${doc.file_name ?? "document"}`}
            />
          ) : (
            <NectarAsk
              question="Upload the written Informed Choice conversation document"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="epr_informed_choice"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── SJD — Assessment Documentation (Discovery Process / Vocational Assessment) ─

type SjdSelection = { assessment_type: "discovery_process" | "vocational_assessment"; assessment_start_date: string | null };

function SjdAssessmentDocumentationCard({
  clientId, orgId, docs, serviceStart, isOrgAdmin,
}: { clientId: string; orgId: string; docs: DocRow[]; serviceStart: string | null; isOrgAdmin: boolean }) {
  const qc = useQueryClient();
  const writeRecordFn = useServerFn(writeClientRecord);

  const selectionQ = useQuery({
    queryKey: ["sjd-assessment-selection", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sjd_assessment_selections" as never)
        .select("assessment_type, assessment_start_date")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SjdSelection | null) ?? { assessment_type: "discovery_process" as const, assessment_start_date: null };
    },
  });

  const selection = selectionQ.data ?? { assessment_type: "discovery_process" as const, assessment_start_date: null };
  const [startDateDraft, setStartDateDraft] = useState(selection.assessment_start_date ?? "");
  useEffect(() => { setStartDateDraft(selection.assessment_start_date ?? ""); }, [selection.assessment_start_date]);

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<SjdSelection>) => {
      await writeRecordFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "sjd_assessment_selections",
          op: "upsert",
          onConflict: "organization_id,client_id",
          values: {
            assessment_type: patch.assessment_type ?? selection.assessment_type,
            assessment_start_date: "assessment_start_date" in patch ? patch.assessment_start_date : selection.assessment_start_date,
            updated_at: new Date().toISOString(),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["sjd-assessment-selection", orgId, clientId] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isDiscovery = selection.assessment_type === "discovery_process";
  const discoveryDoc = docs.find((d) => d.document_type === "sjd_discovery_assessment");
  const vocationalDoc = docs.find((d) => d.document_type === "sjd_vocational_assessment");

  const serviceStartDate = parseLocalDate(serviceStart);
  const discoveryDue = serviceStartDate ? new Date(serviceStartDate.getTime() + 60 * 86_400_000) : null;
  const vocationalStart = parseLocalDate(selection.assessment_start_date);
  const vocationalDue = vocationalStart ? new Date(vocationalStart.getTime() + 30 * 86_400_000) : null;

  function DeadlineBanner({ due, doc, days, missingHint }: { due: Date | null; doc: DocRow | undefined; days: number; missingHint: string }) {
    if (!due) {
      return (
        <div className="rounded-md border border-border p-2.5 text-sm text-muted-foreground">{missingHint}</div>
      );
    }
    const isOverdue = !doc && due.getTime() < Date.now();
    return (
      <div className={cn(
        "rounded-md border p-2.5 text-sm font-medium",
        doc ? "border-emerald-300/60 bg-emerald-50/40 text-emerald-800"
          : isOverdue ? "border-red-300 bg-red-50 text-red-700"
          : "border-amber-300/60 bg-amber-50/40 text-amber-800",
      )}>
        {doc ? `Satisfied — deadline was ${fmtDate(due.toISOString().slice(0, 10))}`
          : isOverdue ? `Overdue — was due ${fmtDate(due.toISOString().slice(0, 10))} (${days} days)`
          : `Due ${fmtDate(due.toISOString().slice(0, 10))} — ${days} days`}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">SJD — Assessment Documentation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Discovery Process or Vocational Assessment — only the selected option is tracked.</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-md border border-border/60 p-3">
            <Label className="text-xs">Assessment type</Label>
            {isOrgAdmin ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className={isDiscovery ? "font-semibold" : "text-muted-foreground"}>Discovery Process</span>
                <Switch
                  checked={!isDiscovery}
                  onCheckedChange={(v) => saveMut.mutate({ assessment_type: v ? "vocational_assessment" : "discovery_process" })}
                  disabled={saveMut.isPending}
                />
                <span className={!isDiscovery ? "font-semibold" : "text-muted-foreground"}>Vocational Assessment</span>
              </div>
            ) : (
              <p className="mt-1 text-sm">{isDiscovery ? "Discovery Process" : "Vocational Assessment"} <span className="text-xs text-muted-foreground">(admin-only to change)</span></p>
            )}
          </div>

          {isDiscovery ? (
            <div className="space-y-3">
              <Label className="text-xs">Individualized Strengths-based Job Discovery Assessment</Label>
              <DeadlineBanner
                due={discoveryDue}
                doc={discoveryDoc}
                days={60}
                missingHint="No SJD service start date on file — set the SJD authorization's start date to compute the deadline."
              />
              {discoveryDoc ? (
                <NectarAsk
                  question="Individualized Strengths-based Job Discovery Assessment"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_discovery_assessment"
                  answeredSummary={`On file since ${fmtDate(discoveryDoc.uploaded_at)} — ${discoveryDoc.file_name ?? "document"}`}
                />
              ) : (
                <NectarAsk
                  question="Upload the Individualized Strengths-based Job Discovery Assessment"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_discovery_assessment"
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">Assessment start date (admin-entered)</Label>
              {isOrgAdmin ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="w-44"
                    value={startDateDraft}
                    onChange={(e) => setStartDateDraft(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saveMut.isPending || startDateDraft === (selection.assessment_start_date ?? "")}
                    onClick={() => saveMut.mutate({ assessment_start_date: startDateDraft || null })}
                  >
                    Save date
                  </Button>
                </div>
              ) : (
                <p className="text-sm">{selection.assessment_start_date ? fmtDate(selection.assessment_start_date) : "Not set — admin must enter the assessment start date."}</p>
              )}
              <Label className="text-xs">Vocational Assessment and Employment Plan</Label>
              <DeadlineBanner
                due={vocationalDue}
                doc={vocationalDoc}
                days={30}
                missingHint="No assessment start date entered yet — an admin must enter it above to compute the deadline."
              />
              {vocationalDoc ? (
                <NectarAsk
                  question="Vocational Assessment and Employment Plan"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_vocational_assessment"
                  answeredSummary={`On file since ${fmtDate(vocationalDoc.uploaded_at)} — ${vocationalDoc.file_name ?? "document"}`}
                />
              ) : (
                <NectarAsk
                  question="Upload the Vocational Assessment and Employment Plan"
                  kind="data_rich_gap"
                  clientId={clientId}
                  uploadDocumentType="sjd_vocational_assessment"
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── SJD — Monthly USOR Outreach Verification ────────────────────────────────

function currentPeriodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function SjdUsorOutreachCard({ clientId, orgId }: { clientId: string; orgId: string }) {
  const qc = useQueryClient();
  const period = currentPeriodLabel();
  const listFn = useServerFn(listUpiAttestations);
  const recordFn = useServerFn(recordUpiAttestation);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["sjd-usor-outreach", orgId, clientId, period],
    queryFn: () => listFn({ data: { organizationId: orgId, kind: "sjd_usor_outreach" } }),
  });
  const current = q.data?.find((a) => a.client_id === clientId && a.period_label === period) ?? null;

  const mut = useMutation({
    mutationFn: () => recordFn({
      data: { organizationId: orgId, clientId, kind: "sjd_usor_outreach", periodLabel: period, noteText: note.trim() || null },
    }),
    onSuccess: () => {
      toast.success("USOR outreach verification recorded.");
      qc.invalidateQueries({ queryKey: ["sjd-usor-outreach"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">USOR Outreach Verification — {formatPeriodMonthYear(period)}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Whether the Person received USOR outreach this month, and current USOR funding status.</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {current ? (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50/40 p-3 text-sm text-emerald-800">
              <div className="font-medium">Entered by {current.attested_by_name ?? "staff"} on {fmtDate(current.attested_at.slice(0, 10))}</div>
              {current.note_text && <div className="mt-1 whitespace-pre-wrap">{current.note_text}</div>}
            </div>
          ) : (
            <>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Person received USOR outreach on 8/10; funding status: active and current."
                rows={2}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
                  {mut.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function age(dob: string | null | undefined): number | null {
  return ageOn(dob);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  // ISO date → MM/DD/YYYY for compactness
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{children ?? <span className="text-muted-foreground font-normal">—</span>}</span>
    </div>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground/80 mt-4 mb-1.5 first:mt-0">{children}</div>;
}

function HexMarker() {
  // Honeycomb marker — small hex with inner dot, themed via primary.
  const hex = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  return (
    <span
      aria-hidden
      className="grid place-items-center h-[18px] w-[18px] bg-primary/15 flex-none"
      style={{ clipPath: hex }}
    >
      <span className="block h-[7px] w-[7px] bg-primary" style={{ clipPath: hex }} />
    </span>
  );
}

function CardShell({
  title, subtitle, editing, onEdit, onSave, onCancel, saving, children, headerRight,
}: {
  title: string;
  subtitle?: string;
  editing?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const canEdit = useAccess().can("edit_client_records");
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            {onEdit && !editing && canEdit ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div>{children}</div>
          {editing ? (
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Record completeness bar ────────────────────────────────────────────────

function RecordCompletenessBar({
  clientId, orgId, client, docs, restriction, isHhs, showElsSchoolDocs, onOpenFiles, onContinueIntake,
}: { clientId: string; orgId: string; client: ClientRow; docs: DocRow[]; restriction: RestrictionRecord | null; isHhs: boolean; showElsSchoolDocs: boolean; onOpenFiles: () => void; onContinueIntake: () => void }) {
  const [open, setOpen] = useState(false);
  const recordAccessFn = useServerFn(recordPhiAccess);

  const isOwnGuardian = client.is_own_guardian === true;
  const dnrStatus = (client.dnr_status as string | null) ?? null;
  const hrApplicable = client.hr_applicable === true;
  const dnrApplicable = client.dnr_applicable === true;

  type RecState = "ok" | "missing" | "na";
  function stateFor(key: RecKey): { state: RecState; doc?: DocRow } {
    if (key === "photograph") {
      const hasPhoto = !!client.client_photo_url;
      return hasPhoto ? { state: "ok" } : { state: "missing" };
    }
    if (key === "hrc_approval") {
      // Yes/No checkbox at the top of the HRC section. "No" = satisfied.
      if (!hrApplicable) return { state: "na" };
      const hrrDoc = docs.find(
        (d) =>
          d.document_type === "hrc_approval" ||
          d.document_type === "human_rights" ||
          (d.file_name ? HRR_FILENAME_RE.test(d.file_name) : false),
      );
      const formComplete = restriction ? computeRestrictionCompletion(restriction).isComplete : false;
      if (hrrDoc && formComplete) return { state: "ok", doc: hrrDoc };
      return { state: "missing" };
    }
    if (key === "room_board_agreement") {
      if (!isHhs) return { state: "na" };
      const rbaDoc = docs.find((d) => d.document_type === "room_board_agreement");
      return rbaDoc ? { state: "ok", doc: rbaDoc } : { state: "missing" };
    }
    if (key === "els_shortened_school_hours" || key === "els_iep") {
      if (!showElsSchoolDocs) return { state: "na" };
      const elsDoc = docs.find((d) => d.document_type === key);
      return elsDoc ? { state: "ok", doc: elsDoc } : { state: "missing" };
    }
    const doc = docs.find((d) => d.document_type === key);
    if (key === "guardian" && isOwnGuardian) return { state: "na" };
    if (key === "dnr") {
      if (doc) return { state: "ok", doc };
      if (dnrApplicable) return { state: "missing" };
      if (dnrStatus === "none" || dnrStatus === "not_applicable" || dnrStatus == null) return { state: "na" };
      return { state: "missing" };
    }
    return doc ? { state: "ok", doc } : { state: "missing" };
  }

  const keys: RecKey[] = ["pcsp", "photograph", "grievance_acknowledgment", "grievance_policy", "individualized_plan", "guardian", "hrc_approval", "dnr", "room_board_agreement", "els_shortened_school_hours", "els_iep"];
  const states = keys.map((k) => ({ key: k, ...stateFor(k) }));
  const applicable = states.filter((s) => s.state !== "na");
  const completed = applicable.filter((s) => s.state === "ok").length;
  const required = applicable.length;
  const missing = required - completed;
  const pct = required ? Math.round((completed / required) * 100) : 100;
  const allDone = missing === 0;

  async function openDoc(doc?: DocRow) {
    if (!doc?.storage_path) { onOpenFiles(); return; }
    try {
      const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(doc.storage_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      void recordAccessFn({
        data: {
          organizationId: orgId,
          resourceType: "client_document",
          resourceId: doc.id,
          clientId,
          action: "download",
          detail: doc.file_name ?? doc.document_type ?? undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      });
      window.open(data.signedUrl, "_blank");
    } catch {
      onOpenFiles();
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 text-left"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Record</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full transition-all", allDone ? "bg-green-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">
            {allDone ? "Record complete" : `${completed} of ${required} required complete`}
          </span>
          {!allDone ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {missing} missing
            </span>
          ) : null}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {open ? (
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Records & documents</div>
            {states.map(({ key, state, doc }) => {
              const label = RECORD_LABELS[key];
              return (
                <div key={key} className="flex items-center gap-3 py-1.5">
                  <div
                    className={cn(
                      "h-6 w-6 rounded grid place-items-center text-xs font-bold flex-none",
                      state === "ok" && "bg-green-100 text-green-700",
                      state === "missing" && "bg-amber-100 text-amber-700",
                      state === "na" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {state === "ok" ? <Check className="h-3.5 w-3.5" /> : state === "missing" ? "!" : "–"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{label.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {key === "photograph" && state === "missing" ? "No photograph on file" : label.sub}
                    </div>
                  </div>
                  {key === "photograph" ? (
                    <span className="text-xs text-muted-foreground px-2">{state === "ok" ? "On file" : "See Identity & contact"}</span>
                  ) : state === "ok" ? (
                    <Button size="sm" variant="outline" onClick={() => openDoc(doc)}>View</Button>
                  ) : state === "missing" ? (
                    <Button size="sm" variant="outline" onClick={onOpenFiles}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2">N/A</span>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={onContinueIntake}>Continue intake</Button>
              <Button size="sm" onClick={onOpenFiles}>Open Client file</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Clinical alert banner ─────────────────────────────────────────────────

function ClinicalAlertBanner({ clientId, client }: { clientId: string; client: ClientRow }) {
  const qc = useQueryClient();
  const canEdit = useAccess().can("edit_client_records");
  const { data: org } = useCurrentOrg();
  const updateClientFn = useServerFn(updateClient);
  const initial = (client.special_directions as string | null) ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);

  const mut = useMutation({
    mutationFn: async () => {
if (!org?.organization_id) throw new Error("No organization selected.");
      await updateClientFn({
        data: { organizationId: org.organization_id, clientId, patch: { special_directions: draft.trim() || null } },
      });
    },
    onSuccess: () => {
      toast.success("Clinical alert updated.");
      qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!initial && !editing) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-none mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Clinical Alert</div>
          {editing ? (
            <textarea
              className="mt-2 w-full min-h-[80px] rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap">{initial}</p>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDraft(initial); setEditing(false); }}>Cancel</Button>
            <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Saving…" : "Save"}</Button>
          </div>
        ) : canEdit ? (
          <Button size="sm" variant="outline" onClick={() => { setDraft(initial); setEditing(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ── Identity & contact ─────────────────────────────────────────────────────

function IdentityCard({ clientId, client }: { clientId: string; client: ClientRow }) {
  const qc = useQueryClient();
  const contacts = useClientContacts(clientId).data ?? [];
  const { data: org } = useCurrentOrg();
  const updateClientFn = useServerFn(updateClient);
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [editing, setEditing] = useState(false);
  const baseline = () => ({
    first_name: (client.first_name as string) ?? "",
    last_name: (client.last_name as string) ?? "",
    medicaid_id: (client.medicaid_id as string) ?? "",
    date_of_birth: (client.date_of_birth as string) ?? "",
    phone_number: (client.phone_number as string) ?? "",
    is_own_guardian: client.is_own_guardian === true,
    admission_date: (client.admission_date as string) ?? "",
    discharge_date: (client.discharge_date as string) ?? "",
    has_abi: client.has_abi === true,
    hr_applicable: client.hr_applicable === true,
    dnr_applicable: client.dnr_applicable === true,
  });
  const [draft, setDraft] = useState(baseline);
  const set = <K extends keyof ReturnType<typeof baseline>>(k: K, v: ReturnType<typeof baseline>[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        first_name: draft.first_name.trim() || null,
        last_name: draft.last_name.trim() || null,
        medicaid_id: draft.medicaid_id.trim() || null,
        date_of_birth: draft.date_of_birth || null,
        phone_number: draft.phone_number.trim() || null,
        is_own_guardian: draft.is_own_guardian,
        admission_date: draft.admission_date || null,
        discharge_date: draft.discharge_date || null,
        has_abi: draft.has_abi,
        hr_applicable: draft.hr_applicable,
        dnr_applicable: draft.dnr_applicable,
      };
if (!org?.organization_id) throw new Error("No organization selected.");
      await updateClientFn({ data: { organizationId: org.organization_id, clientId, patch: payload } });
      if (org?.organization_id && draft.has_abi !== (client.has_abi === true)) {
        try {
          await dutyFactsFn({
            data: { organizationId: org.organization_id, clientId },
          });
        } catch (e) {
          console.warn("[obligations] client ABI duty reevaluate failed:", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
      qc.invalidateQueries({ queryKey: ["client-profile"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const a = age(client.date_of_birth as string | null);
  const dob = fmtDate(client.date_of_birth as string | null);
  const dobAge = client.date_of_birth ? `${dob}${a != null ? ` · ${a}` : ""}` : null;

  const guardian = primaryContact(contacts, "guardian");
  const guardianValue = client.is_own_guardian === true
    ? "Self-guardian"
    : guardian
      ? `Has guardian · ${contactLine(guardian)}`
      : "Has guardian — add them under Contacts";

  return (
    <CardShell
      title="Identity & contact"
      editing={editing}
      onEdit={() => { setDraft(baseline()); setEditing(true); }}
      onSave={() => mut.mutate()}
      onCancel={() => setEditing(false)}
      saving={mut.isPending}
    >
      <div className="space-y-1">
        <div className="pb-4 mb-2 border-b border-border/60">
          <ClientPhotoCard clientId={clientId} />
        </div>

        {!editing ? (
          <>
            <GroupHeader>Person</GroupHeader>
            <Row label="Name">{`${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() || null}</Row>
            <Row label="Individual Medicaid ID">{(client.medicaid_id as string) || null}</Row>
            <Row label="Guardian">{guardianValue}</Row>
            <Row label="Date of birth">{dobAge}</Row>
            <Row label="Phone">{(client.phone_number as string) || null}</Row>
            <Row label="Home address">
              <span className="block max-w-[18rem]">
                {(client.physical_address as string) || "—"}
                <a
                  href="#home-location"
                  className="mt-0.5 block text-xs font-normal text-primary underline-offset-2 hover:underline"
                >
                  Clock-in uses the pin on the Home location map above.
                </a>
              </span>
            </Row>

            <Row label="Support coordinator">{contactLine(primaryContact(contacts, "support_coordinator")) || null}</Row>

            <GroupHeader>Enrollment</GroupHeader>
            <Row label="Admitted">{fmtDate(client.admission_date as string | null)}</Row>
            <Row label="Discharge date">{client.discharge_date ? fmtDate(client.discharge_date as string) : <span className="text-muted-foreground italic font-normal">— active —</span>}</Row>

            <GroupHeader>Flags</GroupHeader>
            <Row label="Acquired brain injury (ABI)">{client.has_abi ? "Yes — staff should have ABI training (reminder on schedule)" : "No"}</Row>
            <Row label="Human Rights documentation">{client.hr_applicable ? "Applicable" : "Not applicable"}</Row>
            <Row label="DNR order">{client.dnr_applicable ? "On — document required" : "Off"}</Row>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <GroupHeader>Person</GroupHeader>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <LabeledInput label="First name" value={draft.first_name} onChange={(v) => set("first_name", v)} />
                <LabeledInput label="Last name" value={draft.last_name} onChange={(v) => set("last_name", v)} />
                <LabeledInput label="Medicaid ID" value={draft.medicaid_id} onChange={(v) => set("medicaid_id", v)} />
                <LabeledInput label="Date of birth" type="date" value={draft.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
                <LabeledInput label="Phone" value={draft.phone_number} onChange={(v) => set("phone_number", v)} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Switch checked={draft.is_own_guardian} onCheckedChange={(v) => set("is_own_guardian", v)} id="self-guardian" />
                <Label htmlFor="self-guardian" className="text-sm">Self-guardian</Label>
              </div>
              {!draft.is_own_guardian ? (
                <p className="mt-2 text-xs text-muted-foreground">Add or edit the guardian and support coordinator under Contacts.</p>
              ) : null}
            </div>

            <div>
              <GroupHeader>Enrollment</GroupHeader>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <LabeledInput label="Admitted" type="date" value={draft.admission_date} onChange={(v) => set("admission_date", v)} />
                <LabeledInput label="Discharge date" type="date" value={draft.discharge_date} onChange={(v) => set("discharge_date", v)} />
              </div>
            </div>

            <div>
              <GroupHeader>Flags</GroupHeader>
              <div className="space-y-2 mt-2">
                <div className="flex items-start gap-3">
                  <Switch id="has-abi" checked={draft.has_abi} onCheckedChange={(v) => set("has_abi", v)} />
                  <Label htmlFor="has-abi" className="text-sm leading-tight">
                    Acquired brain injury (ABI)
                    <div className="text-xs text-muted-foreground font-normal">When on, staff should have ABI training — PI reminds admins on the scheduler but does not block scheduling.</div>
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Switch id="hr-app" checked={draft.hr_applicable} onCheckedChange={(v) => set("hr_applicable", v)} />
                  <Label htmlFor="hr-app" className="text-sm leading-tight">
                    Human Rights documentation applicable
                    <div className="text-xs text-muted-foreground font-normal">When on, a Human Rights document upload is required.</div>
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Switch id="dnr-app" checked={draft.dnr_applicable} onCheckedChange={(v) => set("dnr_applicable", v)} />
                  <Label htmlFor="dnr-app" className="text-sm leading-tight">
                    DNR order on file
                    <div className="text-xs text-muted-foreground font-normal">When on, a DNR document upload is required.</div>
                  </Label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function LabeledInput({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ── At a glance ────────────────────────────────────────────────────────────

function AtGlanceCard({ clientId, client }: { clientId: string; client: ClientRow }) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const updateClientFn = useServerFn(updateClient);
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [editing, setEditing] = useState(false);
  const diagnoses = Array.isArray(client.diagnoses) ? (client.diagnoses as string[]) : [];
  const primaryDx = diagnoses[0] ?? "";
  const primaryDoctor = primaryContact(useClientContacts(clientId).data ?? [], "primary_doctor");
  const baseline = () => ({
    primary_dx: primaryDx,
    pcsp_expiration_date: (client.pcsp_expiration_date as string) ?? "",
  });
  const [draft, setDraft] = useState(baseline);

  const mut = useMutation({
    mutationFn: async () => {
      const newDx = draft.primary_dx.trim();
      const updatedDiagnoses = newDx
        ? [newDx, ...diagnoses.slice(1)]
        : diagnoses.slice(1);
if (!org?.organization_id) throw new Error("No organization selected.");
      await updateClientFn({
        data: {
          organizationId: org.organization_id,
          clientId,
          patch: {
            diagnoses: updatedDiagnoses,
            pcsp_expiration_date: draft.pcsp_expiration_date || null,
          },
        },
      });
      const priorExp = (client.pcsp_expiration_date as string) ?? "";
      if (org?.organization_id && draft.pcsp_expiration_date !== priorExp) {
        try {
          await dutyFactsFn({
            data: { organizationId: org.organization_id, clientId },
          });
        } catch (e) {
          console.warn("[obligations] client PCSP duty reevaluate failed:", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pcspExp = (client.pcsp_expiration_date as string | null) ?? null;
  const pcspWarn = useMemo(() => {
    if (!pcspExp) return false;
    const days = daysUntil(pcspExp);
    return days !== null && days < 30;
  }, [pcspExp]);

  return (
    <CardShell
      title="At a glance"
      editing={editing}
      onEdit={() => { setDraft(baseline()); setEditing(true); }}
      onSave={() => mut.mutate()}
      onCancel={() => setEditing(false)}
      saving={mut.isPending}
    >
      {!editing ? (
        <>
          <Row label="Primary diagnosis">{primaryDx || null}</Row>
          <Row label="Primary care">{contactLine(primaryDoctor) || null}</Row>
          <Row label="PCSP expiration">
            {pcspExp ? (
              <span className={cn("inline-flex items-center gap-1", pcspWarn && "text-red-600 font-semibold")}>
                {pcspWarn ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                {fmtDate(pcspExp)}
              </span>
            ) : (
              <span className="text-muted-foreground italic font-normal">Set expiration</span>
            )}
          </Row>
          <Row label="Admitted">{fmtDate(client.admission_date as string | null)}</Row>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <LabeledInput label="Primary diagnosis" value={draft.primary_dx} onChange={(v) => setDraft((d) => ({ ...d, primary_dx: v }))} />
          <LabeledInput label="PCSP expiration" type="date" value={draft.pcsp_expiration_date} onChange={(v) => setDraft((d) => ({ ...d, pcsp_expiration_date: v }))} />
        </div>
      )}
    </CardShell>
  );
}

// ── Human Rights / HRC ──────────────────────────────────────────────────────

function HrcCard({
  clientId, orgId, client, docs, restriction,
}: { clientId: string; orgId: string; client: ClientRow; docs: DocRow[]; restriction: RestrictionRecord | null }) {
  const qc = useQueryClient();
  const updateClientFn = useServerFn(updateClient);
  const writeRecordFn = useServerFn(writeClientRecord);
  const canEditHrc = useAccess().canCategory("hrc", "edit");
  const hasRestrictions = client.hr_applicable === true;
  const hrrDoc = docs.find(
    (d) =>
      d.document_type === "hrc_approval" ||
      d.document_type === "human_rights" ||
      (d.file_name ? HRR_FILENAME_RE.test(d.file_name) : false),
  );

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of RESTRICTION_ELEMENTS) {
      init[def.textField as string] = (restriction?.[def.textField] as string | null) ?? "";
      if (def.dateField) init[def.dateField as string] = (restriction?.[def.dateField] as string | null) ?? "";
    }
    return init;
  });
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const def of RESTRICTION_ELEMENTS) {
      init[def.textField as string] = (restriction?.[def.textField] as string | null) ?? "";
      if (def.dateField) init[def.dateField as string] = (restriction?.[def.dateField] as string | null) ?? "";
    }
    setFields(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restriction?.id]);

  const toggleMutation = useMutation({
    mutationFn: async (value: boolean) => {
await updateClientFn({ data: { organizationId: orgId, clientId, patch: { hr_applicable: value } } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
      qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string | boolean | null> = { active: true };
      for (const def of RESTRICTION_ELEMENTS) {
        patch[def.textField as string] = fields[def.textField as string]?.trim() || null;
        if (def.dateField) patch[def.dateField as string] = fields[def.dateField as string] || null;
      }
      if (restriction) {
        await writeRecordFn({
          data: { organizationId: orgId, clientId, table: "hrc_restriction_records", op: "update", id: restriction.id, values: patch },
        });
      } else {
        await writeRecordFn({
          data: {
            organizationId: orgId,
            clientId,
            table: "hrc_restriction_records",
            op: "insert",
            values: { restriction_title: "Rights restriction", ...patch },
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("HRC record saved.");
      qc.invalidateQueries({ queryKey: ["client-restrictions", clientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewRecord = { ...(restriction ?? {}) } as RestrictionRecord;
  for (const def of RESTRICTION_ELEMENTS) {
    (previewRecord as unknown as Record<string, string | null>)[def.textField as string] = fields[def.textField as string] || null;
    if (def.dateField) (previewRecord as unknown as Record<string, string | null>)[def.dateField as string] = fields[def.dateField as string] || null;
  }
  const completion = computeRestrictionCompletion(previewRecord);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 px-5 py-4 border-b border-border/60">
          <HexMarker />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Human Rights / HRC</h3>
            <p className="text-xs text-muted-foreground mt-0.5">SOW §1.20 rights-restriction documentation</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3">
            <span className="text-sm font-medium">Does this client have any rights restrictions?</span>
            <div className="flex items-center gap-2 text-sm">
              <span className={!hasRestrictions ? "font-semibold" : "text-muted-foreground"}>No</span>
              <Switch checked={hasRestrictions} disabled={!canEditHrc} onCheckedChange={(v) => toggleMutation.mutate(v)} />
              <span className={hasRestrictions ? "font-semibold" : "text-muted-foreground"}>Yes</span>
            </div>
          </label>

          {!hasRestrictions ? (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50/40 p-3 text-sm text-emerald-800">
              No restrictions — this section is satisfied.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  8-element restriction form
                </span>
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  completion.isComplete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800",
                )}>
                  {completion.completedCount}/{completion.total} complete
                </span>
              </div>
              {RESTRICTION_ELEMENTS.map((def) => (
                <div key={def.key} className="space-y-1">
                  <Label className="text-xs">{def.letter}) {def.label}</Label>
                  <Textarea
                    value={fields[def.textField as string] ?? ""}
                    onChange={(e) => setFields((f) => ({ ...f, [def.textField as string]: e.target.value }))}
                    placeholder={def.description}
                    rows={2}
                  />
                  {def.dateField ? (
                    <Input
                      type="date"
                      className="w-44"
                      value={fields[def.dateField as string] ?? ""}
                      onChange={(e) => setFields((f) => ({ ...f, [def.dateField as string]: e.target.value }))}
                    />
                  ) : null}
                </div>
              ))}
              <div className="flex justify-end">
                {canEditHrc && (
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save restriction form"}
                </Button>
                )}
              </div>

              <div className="pt-2 border-t border-border/60">
                <Label className="text-xs">HRC restriction document — requires staff, coordinator, and client signatures</Label>
                {hrrDoc ? (
                  <NectarAsk
                    question="HRC restriction document — requires staff, coordinator, and client signatures"
                    kind="data_rich_gap"
                    clientId={clientId}
                    uploadDocumentType="hrc_approval"
                    answeredSummary={`On file: ${hrrDoc.file_name ?? "signed document"}`}
                  />
                ) : (
                  <NectarAsk
                    question="Upload the signed HRC restriction document (staff, coordinator, and client signatures)"
                    kind="data_rich_gap"
                    clientId={clientId}
                    uploadDocumentType="hrc_approval"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Record retention footer ────────────────────────────────────────────────

function RetentionFooter({ clientId, status }: { clientId: string; status: string }) {
  const qc = useQueryClient();
  const canEdit = useAccess().can("edit_client_records");
  const { data: org } = useCurrentOrg();
  const updateClientFn = useServerFn(updateClient);
  const isArchived = status === "archived";
  const mut = useMutation({
    mutationFn: async () => {
      const next = isArchived ? "active" : "archived";
if (!org?.organization_id) throw new Error("No organization selected.");
      await updateClientFn({ data: { organizationId: org.organization_id, clientId, patch: { account_status: next } } });
    },
    onSuccess: () => {
      toast.success(isArchived ? "Client reactivated." : "Client archived.");
      qc.invalidateQueries({ queryKey: ["client-profile-tab"] });
      qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Record retention</div>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Medicaid requires client records be kept for 7 years. A client can be <b className="text-foreground font-semibold">archived</b> (hidden from active lists) but the record is never deleted.
        </p>
      </div>
      {canEdit && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="flex-none border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
      >
        {isArchived ? "Reactivate client" : "Archive client"}
      </Button>
      )}
    </div>
  );
}
