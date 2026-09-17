import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-org";
import { useHasPassedLaunchpad } from "@/hooks/use-launchpad-pass";
import { LAUNCHPAD_CLOCK_IN_BLOCKED_MESSAGE } from "@/lib/launchpad-gate";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Play,
  Square,
  MapPin,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  Pencil,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { toast } from "sonner";
import {
  EVV_SERVICE_CODES,
  evvServiceLabel,
  isEvvLockedCode,
  maskMemberId,
  padMemberId,
} from "@/lib/evv-codes";
import { clientAuthorizedCodes } from "@/lib/assignment-codes";
import { roundToQuarterHourISO } from "@/lib/time-rounding";
import { computeEntryUnits } from "@/lib/billing-units";
import { invalidateStaffCaseloadWork } from "@/lib/staff-caseload-cache";
import { EvvConsentGate } from "@/components/evv/consent-gate";
import { evaluateShiftNote } from "@/lib/ai-coach.functions";
import { NECTAR_DRAFT_MIN_WORDS, countNoteWords } from "@/lib/nectar-note-gate";
import {
  type CompletenessItem,
  COMPLETENESS_PASS_FEEDBACK,
  localWordCountCheck,
} from "@/lib/nectar-completeness";
import { freezeOriginalTranscript } from "@/lib/original-transcript";
import { NectarInfusionLock } from "@/components/nectar/nectar-infusion-lock";
import { useNectarInfusion } from "@/hooks/use-nectar-infusion";
import {
  emptyBehaviorAnswers,
  validateBehaviorAnswers,
  type BehaviorAnswers,
} from "@/components/evv/behavior-observations-block";
import { useShiftBehaviorSetting } from "@/hooks/use-shift-behavior-setting";
import { listClientTargetBehaviors } from "@/lib/client-target-behaviors.functions";
import { getPendingTrackingForms } from "@/lib/forms.functions";
import {
  PendingTrackingFormsDialog,
  type PendingForm,
} from "@/components/evv/pending-tracking-forms-dialog";
import { useClientBillingCodes } from "@/hooks/use-client-billing-codes";
import { useClientCareData } from "@/hooks/use-client-care-data";
import type { PendingMedDose } from "@/components/medications/shift-med-due-check";
import { useComplianceGate } from "@/hooks/use-compliance-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerFn } from "@tanstack/react-start";
import {
  checkBillingEntry,
  checkStaffPrerequisite,
  raiseComplianceFlag,
} from "@/lib/nectar-compliance.functions";
import { usePunchGps } from "@/components/evv/use-punch-gps";
import {
  GeofenceVarianceDialog,
  type GeofenceVariance,
} from "@/components/evv/geofence-variance-dialog";
import { PunchPadProceduralAsk } from "@/components/evv/punch-pad-procedural-ask";
import { PunchPadGoalsSection } from "@/components/evv/punch-pad-goals-section";
import { PunchPadNoteSection } from "@/components/evv/punch-pad-note-section";
import { PunchPadShiftSignals } from "@/components/evv/punch-pad-shift-signals";
import {
  PunchPadCompletenessPanel,
  type PunchPadCompletenessFlag,
} from "@/components/evv/punch-pad-completeness-panel";
import { PunchPadSubmitFooter } from "@/components/evv/punch-pad-submit-footer";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = "Client_Profile_Pass" | "General_Sidebar_Unscheduled";

type LockedClient = {
  id: string;
  name: string;
  memberId: string;
  facility?: string | null;
  authorizedCodes?: string[];
  homeLat?: number | null;
  homeLng?: number | null;
  geofenceRadiusFeet?: number | null;
  pcspGoals?: string[];
};

type ActiveShift = {
  id: string;
  client_id: string;
  clock_in_timestamp: string;
  service_type_code: string;
  utah_medicaid_member_id: string;
  shift_entry_type: EntryType;
  client_name?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

import {
  evaluateGeofence,
  haversineFeet,
  isGpsFixConfident,
  resolveGeofenceRadiusFeet,
  MAX_GPS_ACCURACY_METERS,
} from "@/lib/geo";
import { selectedPill, unselectedPill } from "@/components/evv/toggle-styles";

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function providerIdFromOrg(orgId: string | undefined): string {
  if (!orgId) return "0000000";
  const digits = orgId.replace(/\D/g, "");
  return (digits + "0000000").slice(0, 7);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PunchPadProps {
  entryType: EntryType;
  lockedClient?: LockedClient | null;
  caseload?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    medicaid_id: string | null;
    physical_address: string | null;
    job_code?: string[] | null;
    authorized_dspd_codes?: string[] | null;
    home_latitude?: number | null;
    home_longitude?: number | null;
    geofence_radius_feet?: number | null;
    pcsp_goals?: string[] | null;
  }>;
  /** Pre-fill the service code dropdown (e.g. from scheduled shift). */
  presetServiceCode?: string;
  /** When true with presetServiceCode, the code dropdown is read-only. */
  lockServiceCode?: boolean;
  /**
   * When true, auto-open the Shift Verification & Medicaid Compliance form
   * once an active shift for this pad is detected (fires once per mount).
   */
  autoOpenCompliance?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PunchPad({
  entryType,
  lockedClient = null,
  caseload = [],
  presetServiceCode,
  lockServiceCode = false,
  autoOpenCompliance = false,
}: PunchPadProps) {
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();
  const qc = useQueryClient();
  const { passed: hasPassedLaunchpad, blocked: launchpadBlocked } = useHasPassedLaunchpad();

  const { livePos, hardwareDenied, gpsAcquiring, awaitingGps, gpsConfident, waitForConfidentFix } =
    usePunchGps();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [serviceCode, setServiceCode] = useState(presetServiceCode ?? "");

  // Keep preset code in sync if the parent (route search) changes it.
  useEffect(() => {
    if (presetServiceCode) setServiceCode(presetServiceCode);
  }, [presetServiceCode]);
  const [selectedClientId, setSelectedClientId] = useState(lockedClient?.id ?? "");
  const [selectedFacility, setSelectedFacility] = useState(lockedClient?.facility ?? "");
  const [timezone] = useState("America/Denver");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  // ── Clock-in variance state ─────────────────────────────────────────────────
  const [variance, setVariance] = useState<GeofenceVariance | null>(null);
  const [varianceReason, setVarianceReason] = useState("");

  // ── Clock-out variance state ────────────────────────────────────────────────
  const [outVariance, setOutVariance] = useState<GeofenceVariance | null>(null);
  const [outVarianceReason, setOutVarianceReason] = useState("");

  // ── Stage 5: per-shift tracking-form front-guard state ──────────────────────
  // Pending dialog data + which proceed callback to invoke after the user
  // either skips (clock-out) or clears them. The EVV calls live in those
  // callbacks; the guard only PAUSES the punch, never modifies it.
  const [pendingFormsDialog, setPendingFormsDialog] = useState<null | {
    mode: "clockout" | "clockin";
    pending: PendingForm[];
    // Continues the original EVV call path.
    proceed: () => void | Promise<void>;
    // Re-runs the check; if cleared, proceed automatically.
    recheck: () => Promise<void>;
  }>(null);

  // ── Clock-in success state ──────────────────────────────────────────────────
  const [clockInSuccess, setClockInSuccess] = useState<null | {
    evvClean: boolean;
    clientName: string;
  }>(null);

  // ── Clock-out success state ─────────────────────────────────────────────────
  const [success, setSuccess] = useState<null | {
    duration: string;
    evvClean: boolean;
    correctionSubmitted?: boolean;
    awaitingApproval?: boolean;
  }>(null);

  // ── Clock-out compliance modal state ────────────────────────────────────────
  const [showCompliance, setShowCompliance] = useState(false);
  const [checkedGoals, setCheckedGoals] = useState<Record<string, boolean>>({});
  const [baselineChecked, setBaselineChecked] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [showNarrativeError, setShowNarrativeError] = useState(false);
  const [longShiftAck, setLongShiftAck] = useState(false);
  const [triggersResolved, setTriggersResolved] = useState(true);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentTriggerOpen, setIncidentTriggerOpen] = useState(false);
  const [incidentReportIds, setIncidentReportIds] = useState<string[]>([]);
  const [incidentAnswer, setIncidentAnswer] = useState<"yes" | "no" | null>(null);

  // ── Review-by-exception (Timeclock pass) ────────────────────────────────────
  // Variance + attestation + incident + staff-requested time correction. None
  // of these mutate raw clock_in/out timestamps; corrections go to the
  // corrected_clock_in/out + edit_reason fields and the row is routed to
  // supervisor review (review_status='needs_review') instead of billing.
  // The supervisor screen is dashboard.compliance-desk → Needs Review; on
  // approval, billing-units.ts reads corrected_clock_in/out instead of the
  // raw punches. Staff can see status on /dashboard/my-time-corrections.
  const [incidentFlag, setIncidentFlag] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIn, setCorrectionIn] = useState<string>(""); // datetime-local
  const [correctionOut, setCorrectionOut] = useState<string>(""); // datetime-local
  const [correctionReason, setCorrectionReason] = useState("");

  // ── NECTAR submit completeness (note-complete lane only — not billing) ────
  const [aiBusy, setAiBusy] = useState(false);
  const [completenessErrors, setCompletenessErrors] = useState<CompletenessItem[]>([]);

  const { enabled: nectarInfusionEnabled } = useNectarInfusion();
  const [originalTranscript, setOriginalTranscript] = useState("");

  // ── Staff attestation (Medicaid fraud statement) ────────────────────────────
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [attestationTimestamp, setAttestationTimestamp] = useState<string | null>(null);
  const [nectarUsed, setNectarUsed] = useState(false);
  const [nectarAssistChecked, setNectarAssistChecked] = useState(false);
  const [nectarDraftApplied, setNectarDraftApplied] = useState<string | null>(null);

  // ── NECTAR Completeness Check (Infusion add-on) ────────────────────────────
  const [completenessRan, setCompletenessRan] = useState(false);
  const [completenessBusy, setCompletenessBusy] = useState(false);
  const [completenessFlags, setCompletenessFlags] = useState<PunchPadCompletenessFlag[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, string>>({});
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);
  const [dismissReasonDraft, setDismissReasonDraft] = useState("");
  const navigate = useNavigate();

  // ── Post-shift Behavior Observations ───────────────────────────────────────
  const { data: behaviorSetting } = useShiftBehaviorSetting();
  const behaviorEnabled = behaviorSetting?.enabled ?? true;
  const [behaviorAnswers, setBehaviorAnswers] = useState<BehaviorAnswers>(emptyBehaviorAnswers);
  // Target behaviors query lives below, after `active` is in scope.

  // ── Pre-submit medication check (reads real emar_logs, no shadow store) ───
  const [medDosesResolved, setMedDosesResolved] = useState(true);
  const [pendingMedDoses, setPendingMedDoses] = useState<PendingMedDose[]>([]);

  // ── Facilities list ─────────────────────────────────────────────────────────
  const facilities = useMemo(() => {
    const set = new Set<string>();
    caseload.forEach((c) => {
      const a = (c.physical_address ?? "").trim();
      if (a) set.add(a);
    });
    return Array.from(set).sort();
  }, [caseload]);

  // ── Active shift query ──────────────────────────────────────────────────────
  const activeQuery = useQuery({
    enabled: !!user?.id,
    queryKey: ["evv-active", user?.id],
    queryFn: async (): Promise<ActiveShift | null> => {
      const { data, error } = await supabase
        .from("evv_timesheets")
        .select(
          "id, client_id, clock_in_timestamp, service_type_code, " +
            "utah_medicaid_member_id, shift_entry_type, clients(first_name,last_name)",
        )
        .eq("staff_id", user!.id)
        .is("clock_out_timestamp", null)
        .order("clock_in_timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      const c = (d.clients ?? null) as { first_name?: string; last_name?: string } | null;
      return {
        id: d.id,
        client_id: d.client_id,
        clock_in_timestamp: d.clock_in_timestamp,
        service_type_code: d.service_type_code,
        utah_medicaid_member_id: d.utah_medicaid_member_id,
        shift_entry_type: d.shift_entry_type as EntryType,
        client_name: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : undefined,
      };
    },
  });

  const active = activeQuery.data ?? null;
  const activeMatchesThisPad = active && (!lockedClient || active.client_id === lockedClient.id);

  // ── Target Behaviors (must come after `active` is declared) ────────────────
  const listTargetBehaviorsFn = useServerFn(listClientTargetBehaviors);
  const { data: targetBehaviorRows = [] } = useQuery({
    queryKey: ["client-target-behaviors", active?.client_id],
    queryFn: () =>
      listTargetBehaviorsFn({
        data: {
          organization_id: org!.organization_id,
          client_id: active!.client_id,
        },
      }),
    enabled: behaviorEnabled && !!active?.client_id && !!org?.organization_id,
    staleTime: 5 * 60_000,
  });
  const targetBehaviorOptions = targetBehaviorRows.map((b) => b.behavior_name);

  // ── Approved locations (per-client allowlist for variance flagging) ─────────
  // EVV still records actual GPS for every clock-in; this only suppresses the
  // variance prompt when staff is at a pre-approved community site and notes
  // which approved location matched on the EVV record.
  type ApprovedLoc = {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    geofence_radius_feet: number;
  };
  const approvedClientId = lockedClient?.id ?? selectedClientId ?? active?.client_id ?? null;
  const approvedLocsQuery = useQuery({
    enabled: !!approvedClientId,
    queryKey: ["client-approved-locations", approvedClientId],
    queryFn: async (): Promise<ApprovedLoc[]> => {
      const { data, error } = await supabase
        .from("client_approved_locations")
        .select("id, label, latitude, longitude, geofence_radius_feet")
        .eq("client_id", approvedClientId!);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        label: r.label as string,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        geofence_radius_feet: Number(r.geofence_radius_feet),
      }));
    },
  });
  const approvedLocs = approvedLocsQuery.data ?? [];

  function matchApprovedLocation(pos: { lat: number; lng: number }): ApprovedLoc | null {
    for (const loc of approvedLocs) {
      if (!isFinite(loc.latitude) || !isFinite(loc.longitude)) continue;
      const d = haversineFeet({ lat: loc.latitude, lng: loc.longitude }, pos);
      if (d <= loc.geofence_radius_feet) return loc;
    }
    return null;
  }

  // Live elapsed timer — setNow happens only in the browser after hydration,
  // keeping the initial render deterministic (SSR and client agree on now=0).
  useEffect(() => {
    if (!activeMatchesThisPad) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeMatchesThisPad, active?.id]);

  // ── Authorized billing codes (single source of truth: client_billing_codes) ──
  // Used instead of the stale job_code array on the clients row.
  // EVV uses ALL authorized codes (no day-program filter here).
  const effectiveClientId = lockedClient?.id ?? selectedClientId ?? undefined;
  const clientBillingCodesQ = useClientBillingCodes(effectiveClientId || undefined);
  const billingAuthorizedCodes: string[] | undefined = (() => {
    if (!clientBillingCodesQ.data) return undefined;
    const codes = clientBillingCodesQ.data
      .map((b) => String(b.service_code ?? "").trim())
      .filter(Boolean);
    return codes.length ? codes : undefined;
  })();

  // ── Client derivation ───────────────────────────────────────────────────────
  const clientForPunch: LockedClient | null = lockedClient
    ? lockedClient
    : (() => {
        const c = caseload.find((x) => x.id === selectedClientId);
        if (!c) return null;
        return {
          id: c.id,
          name: `${c.first_name} ${c.last_name}`.trim(),
          memberId: padMemberId(c.medicaid_id),
          facility: c.physical_address,
          // Prefer client_billing_codes. Empty/missing 1056 rows fall back to
          // authorized_dspd_codes (then job_code) so SLH still appears.
          authorizedCodes:
            billingAuthorizedCodes ??
            (clientAuthorizedCodes(c).length ? clientAuthorizedCodes(c) : undefined),
          homeLat: c.home_latitude ?? null,
          homeLng: c.home_longitude ?? null,
          geofenceRadiusFeet: c.geofence_radius_feet ?? null,
          pcspGoals: c.pcsp_goals ?? undefined,
        };
      })();

  // ── Service codes ───────────────────────────────────────────────────────────
  const codesForClient = useMemo(() => {
    const authorized = lockedClient
      ? (lockedClient.authorizedCodes ?? billingAuthorizedCodes)
      : billingAuthorizedCodes;
    const fallback = clientForPunch?.authorizedCodes;
    const codes = (authorized?.length ? authorized : fallback) ?? [];
    if (codes.length) {
      return codes.map((code) => ({ code, label: evvServiceLabel(code) }));
    }
    // No authorized codes yet — if still loading, show nothing; once loaded
    // an empty array means the client truly has no authorized codes.
    if (clientBillingCodesQ.isLoading) {
      return EVV_SERVICE_CODES.map((c) => ({ code: c.code, label: c.label }));
    }
    return [];
  }, [lockedClient, billingAuthorizedCodes, clientBillingCodesQ.isLoading, clientForPunch]);

  // ── Geofence derivation ─────────────────────────────────────────────────────
  const mapRadiusFeet = resolveGeofenceRadiusFeet(clientForPunch?.geofenceRadiusFeet);

  const homeCoords =
    typeof clientForPunch?.homeLat === "number" &&
    typeof clientForPunch?.homeLng === "number" &&
    isFinite(clientForPunch.homeLat) &&
    isFinite(clientForPunch.homeLng)
      ? { lat: clientForPunch.homeLat as number, lng: clientForPunch.homeLng as number }
      : null;

  const geofenceDecision = evaluateGeofence({
    home: homeCoords,
    live: livePos,
    accuracyMeters: livePos?.acc ?? null,
    radiusFeet: mapRadiusFeet,
  });

  const insideZone = geofenceDecision.kind === "inside";

  // ── Readiness guard ─────────────────────────────────────────────────────────
  const requireFacility = entryType === "General_Sidebar_Unscheduled";
  const inReady =
    !!serviceCode &&
    !!clientForPunch &&
    (!requireFacility || !!selectedFacility) &&
    !!org?.organization_id;

  // ── GPS status label ────────────────────────────────────────────────────────
  const gpsStatusLabel = (() => {
    if (hardwareDenied)
      return {
        text: "⚠️ Location blocked — open device Settings and enable location for this site. Clock-in is held until GPS is available.",
        color: "amber" as const,
      };
    if (gpsAcquiring || !livePos)
      return {
        text: "📡 Acquiring high-accuracy GPS — wait for a live fix before clocking in.",
        color: "neutral" as const,
      };
    if (!serviceCode)
      return { text: "📍 GPS confirmed. Select a service code above.", color: "neutral" as const };
    if (!isEvvLockedCode(serviceCode))
      return {
        text: `🛈 ${serviceCode} — GPS logged passively, geofence not enforced for this code.`,
        color: "neutral" as const,
      };
    if (livePos && !gpsConfident)
      return {
        text: `📡 GPS is too coarse to confirm you are at the saved home pin (±${Math.round(livePos.acc)} m). Wait for a better fix — this is not an out-of-zone reading.`,
        color: "amber" as const,
      };
    if (geofenceDecision.kind === "no_home_pin")
      return {
        text: "📍 GPS live. No home pin is saved on this client — an administrator should set it. Geofence is not enforced until a pin exists.",
        color: "amber" as const,
      };
    const matchedHere =
      livePos && gpsConfident
        ? matchApprovedLocation({ lat: livePos.lat, lng: livePos.lng })
        : null;
    if (matchedHere)
      return {
        text: `🟢 GPS confirmed — inside approved location "${matchedHere.label}". No variance required.`,
        color: "green" as const,
      };
    if (insideZone)
      return {
        text: `🟢 GPS confirmed — you are within ${mapRadiusFeet} ft of the saved home pin.`,
        color: "green" as const,
      };
    return {
      text: `🔴 Outside the ${mapRadiusFeet} ft zone around the saved home pin — a written variance is required. This is not “GPS is off.”`,
      color: "red" as const,
    };
  })();

  const gpsStripClass = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    neutral: "border-border bg-muted/40 text-muted-foreground",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  }[gpsStatusLabel.color];

  // ────────────────────────────────────────────────────────────────────────────
  // Stage 5 — Per-shift tracking-form FRONT-GUARDS (read-only, fail-open).
  // These run BEFORE the EVV write calls (writeShift / finalizeClockOut).
  // They NEVER touch evv_timesheets, GPS, status, or timestamps.
  // ────────────────────────────────────────────────────────────────────────────
  async function fetchPendingTrackingForms(
    input:
      | { tier: "clockout"; shiftId: string; clientId: string; serviceCode: string }
      | { tier: "clockin" },
  ): Promise<PendingForm[]> {
    // ~1.5s timeout. ANY error/timeout → return [] so the caller proceeds.
    const PROMISE_TIMEOUT_MS = 1500;
    try {
      const result = await Promise.race<{ pending: PendingForm[] } | "TIMEOUT">([
        getPendingTrackingForms({ data: input }),
        new Promise<"TIMEOUT">((resolve) =>
          setTimeout(() => resolve("TIMEOUT"), PROMISE_TIMEOUT_MS),
        ),
      ]);
      if (result === "TIMEOUT") return [];
      return result?.pending ?? [];
    } catch {
      return [];
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // WRITE SHIFT (clock-in DB write)
  // ────────────────────────────────────────────────────────────────────────────

  async function writeShift(args: {
    pos: { lat: number; lng: number; acc: number } | null;
    outsideReason?: string;
    gpsBypassReason?: string;
  }) {
    if (!user || !org || !clientForPunch) return;
    if (!hasPassedLaunchpad) {
      toast.error(LAUNCHPAD_CLOCK_IN_BLOCKED_MESSAGE);
      return;
    }
    const nowIso = new Date().toISOString();
    const isOutOfBounds = !!args.outsideReason;
    const isGpsBypass = !!args.gpsBypassReason;
    const matched =
      args.pos && isFinite(args.pos.acc) && args.pos.acc <= MAX_GPS_ACCURACY_METERS
        ? matchApprovedLocation({ lat: args.pos.lat, lng: args.pos.lng })
        : null;

    const payload = {
      organization_id: org.organization_id,
      staff_id: user.id,
      client_id: clientForPunch.id,
      utah_medicaid_provider_id: providerIdFromOrg(org.organization_id),
      utah_medicaid_member_id: clientForPunch.memberId,
      service_type_code: serviceCode,
      gps_in_coordinates: args.pos
        ? { latitude: args.pos.lat, longitude: args.pos.lng, accuracy_meters: args.pos.acc }
        : { latitude: null, longitude: null, accuracy_meters: null },
      shift_entry_type: entryType,
      status: "Active",
      timezone_setting: timezone,
      outside_geofence_reason: args.outsideReason ?? null,
      gps_validated: !isOutOfBounds && !isGpsBypass,
      is_out_of_bounds: isOutOfBounds,
      geofence_variance_justification: args.outsideReason ?? null,
      // Enroll out-of-bounds punches into the EVV Reconciliation queue so an
      // admin/manager can document a review decision (accept/correct/flag).
      reconciliation_status: isOutOfBounds ? "pending" : null,
      raw_clock_in: nowIso,
      rounded_clock_in: roundToQuarterHourISO(nowIso),
      matched_approved_location_id: matched?.id ?? null,
      matched_approved_location_label: matched?.label ?? null,
      // GPS entirely unavailable at clock-in (denied/no fix), distinct from an
      // out-of-bounds geofence variance: staff proceeds with a reason and the
      // EVV record falls back to the client's on-file address for location
      // evidence (Utah UEVV accepts address OR GPS at begin/end of visit).
      gps_in_bypassed: isGpsBypass,
      gps_in_bypass_reason: args.gpsBypassReason ?? null,
    };

    // ── Staff-prerequisite gate: block clock-in if the staff lacks a required
    // qualification for this service code. Restrict-vs-override policy:
    //   staff → detect + raise flag + halt (no evv_timesheets row written).
    //   admin/manager/super_admin → dialog offers Acknowledge & continue / Stop.
    // Engine unchanged; only a hook call + branch is added here.
    const codesUpper = [String(serviceCode).toUpperCase()].filter(Boolean);
    const orgId = org.organization_id;

    const runInsert = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("evv_timesheets").insert(payload as any);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["evv-active", user.id] });
      setClockInSuccess({
        evvClean: !isOutOfBounds,
        clientName: clientForPunch.name,
      });
      return { ok: true } as const;
    };

    if (orgId && codesUpper.length > 0) {
      if (canOverrideCompliance) {
        const gateResult = await evvClockInGate(
          {
            clientId: clientForPunch.id,
            staffId: user.id,
            serviceCodes: codesUpper,
            at: nowIso,
          },
          runInsert,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (gateResult && (gateResult as any).stopped) {
          toast.message("Clock-in halted per your compliance decision. Flag logged for audit.");
          return;
        }
        return;
      } else {
        const detected = (await detectStaffPrereq({
          data: {
            organizationId: orgId,
            staffId: user.id,
            serviceCodes: codesUpper,
            clientId: clientForPunch.id,
            at: nowIso,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        })) as {
          flags: Array<{
            ruleId: string;
            requirementId: string;
            matchedCodes: string[];
            source: { title: string; verbatim: string; citation: string | null };
          }>;
        };
        if (detected?.flags?.length) {
          for (const c of detected.flags) {
            try {
              await raiseComplianceFlagFn({
                data: {
                  organizationId: orgId,
                  ruleId: c.ruleId,
                  requirementId: c.requirementId,
                  detectionType: "staff_prerequisite",
                  subjectContext: {
                    client_id: clientForPunch.id,
                    date: nowIso.slice(0, 10),
                    staff_id: user.id,
                    service_codes: codesUpper,
                    source: "evv_clock_in",
                    missing_qualifications: c.matchedCodes,
                    restricted_for_role: role ?? "unknown",
                  },
                  sourceSnapshot: c.source,
                },
              });
            } catch {
              // Non-fatal: continue raising remaining flags.
            }
          }
          toast.error(
            "Clock-in held for compliance review. A required qualification is missing — a supervisor must resolve the flag before you can clock in.",
          );
          return;
        }
      }
    }

    await runInsert();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CLOCK-IN HANDLER
  // ────────────────────────────────────────────────────────────────────────────

  async function handleClockIn() {
    if (!user || !org || !clientForPunch) return;
    if (!hasPassedLaunchpad) {
      toast.error(LAUNCHPAD_CLOCK_IN_BLOCKED_MESSAGE);
      return;
    }
    if (!clientForPunch.memberId) {
      toast.error("Client is missing a Utah Medicaid Member ID.");
      return;
    }
    setBusy(true);
    try {
      if (hardwareDenied) {
        toast.error(
          "Location is blocked. Enable location for this site in device Settings, then retry. Clock-in is held until GPS is captured.",
        );
        return;
      }

      const pos = await waitForConfidentFix();

      if (!pos) {
        toast.error(
          "No GPS fix yet. Wait for high-accuracy GPS and retry — clock-in is held until a live location is captured.",
        );
        return;
      }
      if (!isGpsFixConfident(pos)) {
        toast.error(
          `GPS is too coarse (±${Math.round(pos.acc)} m) to confirm the saved home pin. Wait for a better fix and retry — this is not an out-of-zone variance.`,
        );
        return;
      }

      // Hidden Gatekeeper: only EVV-locked codes enforce the geofence wall.
      if (isEvvLockedCode(serviceCode)) {
        const decision = evaluateGeofence({
          home: homeCoords,
          live: pos,
          accuracyMeters: pos.acc,
          radiusFeet: mapRadiusFeet,
        });
        if (decision.kind === "outside") {
          const matched = matchApprovedLocation({ lat: pos.lat, lng: pos.lng });
          if (!matched) {
            setVariance({
              distanceFeet: Math.round(decision.distanceFeet),
              limitFeet: decision.limitFeet,
              pos,
            });
            setVarianceReason("");
            return;
          }
        }
      }

      // Stage 5 — required_before_next_clockin front-guard. READ-ONLY,
      // fail-open: on error/timeout the guard returns [] and we proceed.
      // This is BEFORE writeShift; writeShift's payload is untouched.
      const pendingIn = await fetchPendingTrackingForms({ tier: "clockin" });
      if (pendingIn.length) {
        setPendingFormsDialog({
          mode: "clockin",
          pending: pendingIn,
          proceed: async () => {
            setPendingFormsDialog(null);
            setBusy(true);
            try {
              await writeShift({ pos });
            } finally {
              setBusy(false);
            }
          },
          recheck: async () => {
            const again = await fetchPendingTrackingForms({ tier: "clockin" });
            if (!again.length) {
              setPendingFormsDialog(null);
              setBusy(true);
              try {
                await writeShift({ pos });
              } finally {
                setBusy(false);
              }
            } else {
              setPendingFormsDialog((p) => (p ? { ...p, pending: again } : p));
            }
          },
        });
        return;
      }

      await writeShift({ pos });
    } catch (e) {
      toast.error((e as Error).message || "Could not start shift.");
    } finally {
      setBusy(false);
    }
  }

  async function submitVariance() {
    if (!variance) return;
    const reason = varianceReason.trim();
    if (reason.length < 10) {
      toast.error("Please type at least 10 characters of justification.");
      return;
    }
    // Truly no GPS (denied/no fix) → GPS-bypass path (address fallback at
    // export time), distinct from a geofence out-of-bounds variance.
    const isBypass = !!variance.frameBlocked;
    setBusy(true);
    try {
      // Stage 5 — same front-guard for variance clock-in path. Fail-open.
      const pendingIn = await fetchPendingTrackingForms({ tier: "clockin" });
      if (pendingIn.length) {
        const pos = variance.pos;
        const outside = reason;
        setPendingFormsDialog({
          mode: "clockin",
          pending: pendingIn,
          proceed: async () => {
            setPendingFormsDialog(null);
            setBusy(true);
            try {
              await writeShift(
                isBypass ? { pos, gpsBypassReason: outside } : { pos, outsideReason: outside },
              );
              setVariance(null);
              setVarianceReason("");
            } finally {
              setBusy(false);
            }
          },
          recheck: async () => {
            const again = await fetchPendingTrackingForms({ tier: "clockin" });
            if (!again.length) {
              setPendingFormsDialog(null);
              setBusy(true);
              try {
                await writeShift(
                  isBypass ? { pos, gpsBypassReason: outside } : { pos, outsideReason: outside },
                );
                setVariance(null);
                setVarianceReason("");
              } finally {
                setBusy(false);
              }
            } else {
              setPendingFormsDialog((p) => (p ? { ...p, pending: again } : p));
            }
          },
        });
        return;
      }

      await writeShift(
        isBypass
          ? { pos: variance.pos, gpsBypassReason: reason }
          : { pos: variance.pos, outsideReason: reason },
      );
      setVariance(null);
      setVarianceReason("");
    } catch (e) {
      toast.error((e as Error).message || "Could not start shift.");
    } finally {
      setBusy(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CLOCK-OUT FLOW
  // ────────────────────────────────────────────────────────────────────────────

  // Structured PCSP goals for the active shift's client come through the
  // canonical shared reader (`useClientCareData`). Clock-out shows every
  // visible on-file goal (untagged included). No screen re-filters.
  const activeClientIdForGoals = active?.client_id ?? null;
  const careData = useClientCareData(activeClientIdForGoals, active?.service_type_code ?? null);

  const activeClientGoals = useMemo<string[]>(() => {
    const rows = careData.data?.visibility.goalsForStaff ?? [];
    const fromCare = rows.map((g) => g.goal.trim()).filter((s) => s.length > 0);
    if (fromCare.length > 0) return fromCare;
    return (lockedClient?.pcspGoals ?? []).map((g) => String(g).trim()).filter((s) => s.length > 0);
  }, [careData.data, lockedClient?.pcspGoals]);

  const wordCount = useMemo(() => countNoteWords(narrative), [narrative]);

  const hasGoalSelected = baselineChecked || Object.values(checkedGoals).some(Boolean);
  const narrativeOk = wordCount >= NECTAR_DRAFT_MIN_WORDS;
  const behaviorError = behaviorEnabled ? validateBehaviorAnswers(behaviorAnswers) : null;
  const behaviorOk = behaviorError === null;
  const liveDurationMs = active
    ? Math.max(0, now - new Date(active.clock_in_timestamp).getTime())
    : 0;
  const isLongShift = liveDurationMs > 16 * 60 * 60 * 1000;
  // Correction request: staff is explicitly saying the recorded times are
  // wrong. Parse datetime-local values, require at least one changed field,
  // require reason ≥ 10 chars, and validate ordering / sanity window.
  const correctionInIso = correctionIn ? new Date(correctionIn).toISOString() : null;
  const correctionOutIso = correctionOut ? new Date(correctionOut).toISOString() : null;
  const effectiveInIso = correctionInIso ?? active?.clock_in_timestamp ?? null;
  const effectiveOutMs = correctionOutIso ? new Date(correctionOutIso).getTime() : now;
  const effectiveInMs = effectiveInIso ? new Date(effectiveInIso).getTime() : NaN;
  const correctionOrderOk = Number.isFinite(effectiveInMs) && effectiveOutMs > effectiveInMs;
  const correctionWithinWindow =
    !!active &&
    Number.isFinite(effectiveInMs) &&
    effectiveOutMs - new Date(active.clock_in_timestamp).getTime() <= 36 * 60 * 60 * 1000 &&
    effectiveInMs >= new Date(active.clock_in_timestamp).getTime() - 24 * 60 * 60 * 1000;
  const correctionHasChange =
    (!!correctionInIso && correctionInIso !== active?.clock_in_timestamp) || !!correctionOutIso;
  const correctionReasonOk = correctionReason.trim().length >= 10;
  const correctionValid =
    correctionOpen &&
    correctionHasChange &&
    correctionReasonOk &&
    correctionOrderOk &&
    correctionWithinWindow;
  // When staff opens a correction, the "these times are accurate" ack is
  // moot — the whole point is that they aren't.
  const longShiftOk = !isLongShift || longShiftAck || correctionOpen;
  const canSubmitCompliance =
    hasGoalSelected &&
    narrativeOk &&
    behaviorOk &&
    longShiftOk &&
    triggersResolved &&
    medDosesResolved &&
    incidentAnswer !== null &&
    !busy &&
    attestationChecked &&
    (!nectarUsed || nectarAssistChecked) &&
    (!correctionOpen || !correctionHasChange || correctionValid);

  function openCompliance() {
    if (!active) return;
    setNarrative("");
    setOriginalTranscript("");
    setCheckedGoals({});
    setBaselineChecked(false);
    setBehaviorAnswers(emptyBehaviorAnswers);
    setIncidentFlag(false);
    setIncidentAnswer(null);

    setShowNarrativeError(false);
    setCompletenessErrors([]);
    setAttestationChecked(false);
    setAttestationTimestamp(null);
    setNectarUsed(false);
    setNectarAssistChecked(false);
    setNectarDraftApplied(null);
    setCompletenessRan(false);
    setCompletenessFlags([]);
    setDismissals({});
    setDismissingKey(null);
    setDismissReasonDraft("");
    setLongShiftAck(false);
    setTriggersResolved(true);
    setMedDosesResolved(true);
    setPendingMedDoses([]);
    setIncidentReportIds([]);
    setCorrectionOpen(false);
    setCorrectionIn("");
    setCorrectionOut("");
    setCorrectionReason("");
    setShowCompliance(true);
  }

  // Auto-open the Shift Verification & Medicaid Compliance form once, when
  // arriving here from a "Fix Now" deep link for an open shift.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenCompliance) return;
    if (autoOpenedRef.current) return;
    if (!active || !activeMatchesThisPad) return;
    autoOpenedRef.current = true;
    openCompliance();
    // Strip the one-shot ?verify param so reloads don't reopen the modal.
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const { verify: _drop, ...rest } = prev;
        return rest;
      },
      replace: true,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCompliance, active, activeMatchesThisPad]);

  // Format an ISO/Date as the value expected by <input type="datetime-local">
  // in the browser's local timezone: YYYY-MM-DDTHH:MM.
  function toLocalDatetimeInput(v: string | number | Date): string {
    const d = new Date(v);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openCorrectionPanel(a: ActiveShift) {
    setCorrectionOpen(true);
    // Seed inputs so staff can nudge one field without retyping the whole
    // date/time. Unchanged fields are treated as "this one was fine" only
    // when they match the recorded value (see correctionHasChange).
    setCorrectionIn((prev) => prev || toLocalDatetimeInput(a.clock_in_timestamp));
    setCorrectionOut((prev) => prev || toLocalDatetimeInput(now));
    if (!correctionReason) setCorrectionReason("");
  }

  // Re-running the check is required after staff edit the note/goals
  useEffect(() => {
    if (completenessRan) {
      setCompletenessRan(false);
      setCompletenessFlags([]);
      setDismissals({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrative, checkedGoals, baselineChecked]);

  async function runCompletenessCheck(): Promise<PunchPadCompletenessFlag[]> {
    if (!active) return [];
    setCompletenessBusy(true);
    const flags: PunchPadCompletenessFlag[] = [];
    try {
      // Hard checks first (mirror existing field validation in the panel)
      if (!hasGoalSelected) {
        flags.push({
          key: "no-goal",
          type: "missing_goal",
          severity: "hard",
          message: "Select at least one PCSP goal or baseline monitoring above.",
          fix: { label: "Pick a goal" },
        });
      }
      if (!narrativeOk) {
        flags.push({
          key: "short-note",
          type: "narrative_too_short",
          severity: "hard",
          message: `Progress note is ${wordCount} words — write at least ${NECTAR_DRAFT_MIN_WORDS}.`,
          fix: { label: "Expand note" },
        });
      }
      // Soft cross-checks (Infusion layer)
      const dollarMatches = narrative.match(/\$\s?\d+(?:\.\d{1,2})?/g) ?? [];

      const spendQ = await supabase
        .from("client_spending_log")
        .select("id, amount", { count: "exact", head: false })
        .eq("shift_id", active.id);
      const loggedSpend = spendQ.data ?? [];

      if (dollarMatches.length > 0 && loggedSpend.length === 0) {
        flags.push({
          key: "mentioned-spend",
          type: "spend_mentioned_not_logged",
          severity: "soft",
          message: `You mentioned ${dollarMatches.slice(0, 3).join(", ")} in the note — add to the client spending log?`,
          fix: {
            label: "Open spending log",
            route: `/dashboard/workspace/${active.client_id}`,
          },
        });
      }

      const reimbQ = await supabase
        .from("activity_reimbursement_requests")
        .select("id, status, receipt_paths, event_summary")
        .eq("shift_id", active.id)
        .eq("status", "approved");
      const approvedReimbs = reimbQ.data ?? [];
      const missingReceipt = approvedReimbs.find(
        (r) => !Array.isArray(r.receipt_paths) || r.receipt_paths.length === 0,
      );
      if (missingReceipt) {
        flags.push({
          key: `reimb-no-receipt-${missingReceipt.id}`,
          type: "reimbursement_receipt_missing",
          severity: "soft",
          message: "An approved activity reimbursement has no receipt uploaded yet.",
          fix: { label: "Upload receipt", route: "/dashboard/reimbursements" },
        });
      }
      const missingSummary = approvedReimbs.find((r) => !r.event_summary);
      if (missingSummary) {
        flags.push({
          key: `reimb-no-summary-${missingSummary.id}`,
          type: "reimbursement_summary_missing",
          severity: "soft",
          message: "Approved activity has no event summary — add one for billing.",
          fix: { label: "Add summary", route: "/dashboard/reimbursements" },
        });
      }

      setCompletenessFlags(flags);
      setCompletenessRan(true);
      return flags;
    } catch (e) {
      toast.error((e as Error).message || "Couldn't run completeness check.");
      return flags;
    } finally {
      setCompletenessBusy(false);
    }
  }

  function jumpToFix(flag: PunchPadCompletenessFlag) {
    if (flag.fix?.route) {
      setShowCompliance(false);
      navigate({ to: flag.fix.route });
    } else {
      // In-form hard issues — just close any dismiss draft and scroll focus
      setDismissingKey(null);
      toast.info(flag.fix?.label ?? "Address this above, then re-check.");
    }
  }

  function confirmDismiss(key: string) {
    const reason = dismissReasonDraft.trim();
    if (reason.length < 5) {
      toast.error("Add a short reason (5+ chars) so the admin knows why.");
      return;
    }
    setDismissals((d) => ({ ...d, [key]: reason }));
    setDismissingKey(null);
    setDismissReasonDraft("");
  }

  // ── Compliance gate (billing_conflict detector) at clock-out ────────────
  // Growth-adaptive: one useComplianceGate call, its own buildInput/buildSubject,
  // plus a restrict-vs-override branch. Engine (dialog, rules, flags, history,
  // freeze trigger, raise/resolve fns) and detector registry are UNTOUCHED.
  const { role } = usePermissions();
  const canOverrideCompliance =
    role === "admin" || role === "program_manager" || role === "manager";
  const detectBillingConflict = useServerFn(checkBillingEntry);
  const detectStaffPrereq = useServerFn(checkStaffPrerequisite);
  const raiseComplianceFlagFn = useServerFn(raiseComplianceFlag);

  type EvvGatePayload = {
    clientId: string;
    serviceDate: string;
    serviceCodes: string[];
    staffId: string;
    timesheetId: string;
  };
  const { gate: evvComplianceGate, dialogElement: complianceDialogEl } =
    useComplianceGate<EvvGatePayload>({
      organizationId: org?.organization_id ?? "",
      detector: "billing",
      buildInput: (p) => ({
        clientId: p.clientId,
        serviceDate: p.serviceDate,
        serviceCodes: p.serviceCodes,
        staffId: p.staffId,
      }),
      buildSubject: (p) => ({
        timesheet_id: p.timesheetId,
        client_id: p.clientId,
        date: p.serviceDate,
        staff_id: p.staffId,
        source: "evv_close",
      }),
    });

  // ── Compliance gate (staff_prerequisite detector) at clock-in ───────────
  // Second surface on the same growth-adaptive contract: one hook call,
  // its own buildInput/buildSubject, restrict-vs-override branch. Engine,
  // registry, dialog, and raise/resolve fns are UNTOUCHED.
  type EvvClockInGatePayload = {
    clientId: string;
    staffId: string;
    serviceCodes: string[];
    at: string;
  };
  const { gate: evvClockInGate, dialogElement: clockInComplianceDialogEl } =
    useComplianceGate<EvvClockInGatePayload>({
      organizationId: org?.organization_id ?? "",
      detector: "staffPrereq",
      buildInput: (p) => ({
        staffId: p.staffId,
        serviceCodes: p.serviceCodes,
        clientId: p.clientId,
        at: p.at,
      }),
      buildSubject: (p) => ({
        client_id: p.clientId,
        date: p.at.slice(0, 10),
        staff_id: p.staffId,
        service_codes: p.serviceCodes,
        source: "evv_clock_in",
      }),
    });

  /**
   * Preserve the punch without finalizing billable commit. Persists
   * documentation fields already gathered by staff (clock-out timestamps,
   * narrative, goals, GPS, timezone, outside-geofence reason) but withholds
   * `billed_units` — that field is the "billable finalize done" marker the
   * supervisor queue keys off. `billed_units IS NULL` + a clock-out + an
   * OPEN evv_close flag identifies a held timesheet.
   */
  async function preservePunchOnly(clockOutIso: string, fullUpdate: Record<string, unknown>) {
    if (!active) return;
    // Strip the billable-commit marker; keep everything staff already filled in.
    const { billed_units: _billedUnits, ...preserved } = fullUpdate;
    const preservedUpdate = {
      ...preserved,
      clock_out_timestamp: clockOutIso,
      raw_clock_out: clockOutIso,
      rounded_clock_out: roundToQuarterHourISO(clockOutIso),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    await supabase.from("evv_timesheets").update(preservedUpdate).eq("id", active.id);
    await qc.invalidateQueries({ queryKey: ["evv-active", user?.id] });
  }

  /** Gather all other service codes committed for this client on this date. */
  async function gatherDayCommittedCodes(
    clientId: string,
    dateISO: string,
    excludeTimesheetId: string,
  ): Promise<string[]> {
    const dayStart = `${dateISO}T00:00:00`;
    const dayEnd = `${dateISO}T23:59:59.999`;
    const [shiftsRes, tsRes] = await Promise.all([
      supabase
        .from("scheduled_shifts")
        .select("service_code")
        .eq("client_id", clientId)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd),
      supabase
        .from("evv_timesheets")
        .select("id, service_type_code")
        .eq("client_id", clientId)
        .gte("clock_in_timestamp", dayStart)
        .lte("clock_in_timestamp", dayEnd),
    ]);
    const codes = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (shiftsRes.data ?? []).forEach((r: any) => {
      if (r?.service_code) codes.add(String(r.service_code).toUpperCase());
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tsRes.data ?? []).forEach((r: any) => {
      if (r?.id !== excludeTimesheetId && r?.service_type_code) {
        codes.add(String(r.service_type_code).toUpperCase());
      }
    });
    return Array.from(codes);
  }

  async function finalizeClockOut(args: {
    pos: { lat: number; lng: number; acc: number } | null;
    outsideReason?: string;
    gpsBypassReason?: string;
    aiStatus?: "Verified" | "Flagged" | "Exception" | "skipped_service_unavailable";
    aiFeedback?: string;
    aiIterationCount?: number;
    correction?: {
      correctedInIso: string | null;
      correctedOutIso: string | null;
      reason: string;
    };
  }) {
    if (!user || !active) return;

    // Flush the shift-med checklist into emar_logs BEFORE the timesheet commits.
    // If any dose fails, abort — nothing partial ends up in the DB.
    if (pendingMedDoses.length > 0) {
      try {
        const { logMedicationPass } = await import("@/lib/emar-pass.functions");
        for (const dose of pendingMedDoses) {
          await logMedicationPass({ data: dose });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Medication log failed: ${msg}`);
        return;
      }
    }

    const selectedGoals = Object.entries(checkedGoals)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (baselineChecked) selectedGoals.push("General baseline monitoring & safety oversight");

    const clockOut = new Date().toISOString();
    const update: Record<string, unknown> = {
      clock_out_timestamp: clockOut,
      gps_out_coordinates: args.pos
        ? { latitude: args.pos.lat, longitude: args.pos.lng, accuracy_meters: args.pos.acc }
        : { latitude: null, longitude: null, accuracy_meters: null },
      status: "Pending",
      timezone_setting: "America/Denver",
      shift_note_text: narrative.trim(),
      goals_completed: selectedGoals,
      raw_clock_out: clockOut,
      rounded_clock_out: roundToQuarterHourISO(clockOut),
      // Per-entry quarter-hour units (round-to-NEAREST); raw timestamps stay untouched.
      billed_units: computeEntryUnits(active.clock_in_timestamp, clockOut),
    };
    update.nectar_drafted = nectarUsed;
    update.nectar_review_service_code = active.service_type_code;
    update.attested_accurate = true;
    update.attested_at = attestationTimestamp;
    const frozenOriginal = freezeOriginalTranscript(originalTranscript, null);
    if (frozenOriginal) {
      // Frozen original speech — never replaced with later edits to the note.
      update.original_transcript = frozenOriginal;
    }

    // Permanent legal record of the staff attestation — written for every
    // submitted shift, not just ones NECTAR reviewed.
    const { error: attErr } = await supabase.from("nectar_attestations").insert({
      organization_id: org?.organization_id ?? null,
      user_id: user.id,
      user_display_name: user.email ?? null,
      scope: "shift_note",
      scope_ref_id: active.id,
      scope_ref_type: "evv_timesheet",
      statement:
        "I attest that this shift note is accurate and truthful, that it reflects services I personally provided, and that I understand submitting false Medicaid documentation constitutes fraud. Warning: Falsification of Medicaid service records is a federal offense under 18 U.S.C. § 1347.",
      context: {
        client_id: active.client_id,
        service_code: active.service_type_code,
        nectar_review_status: args.aiStatus ?? "not_reviewed",
      },
      original_staff_input: frozenOriginal || null,
      nectar_expanded_output: nectarUsed ? nectarDraftApplied : null,
      input_confirmed_at: attestationTimestamp,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (attErr) {
      toast.error(`Attestation log failed: ${attErr.message}`);
      return;
    }
    if (args.outsideReason) update.outside_geofence_reason = args.outsideReason;
    if (args.gpsBypassReason) {
      // GPS entirely unavailable at clock-out — proceed with a reason and
      // fall back to the client's on-file address for location evidence.
      update.gps_out_bypassed = true;
      update.gps_out_bypass_reason = args.gpsBypassReason;
    }
    if (incidentAnswer === "no") {
      update.incident_flag = false;
    } else if (incidentFlag || incidentReportIds.length > 0) {
      update.incident_flag = true;
    }
    if (args.aiStatus) {
      update.ai_compliance_status = args.aiStatus;
      update.ai_compliance_feedback = args.aiFeedback ?? null;
      update.ai_coaching_iterations = args.aiIterationCount ?? 0;
    }

    // Staff-requested time correction: never mutate raw punches. Write
    // corrected_clock_in/out, edit_reason, and route to supervisor via
    // review_status='needs_review'. Corrected times only become effective
    // for billing after the supervisor approves (see billing-units.ts).
    if (args.correction) {
      const { correctedInIso, correctedOutIso, reason } = args.correction;
      if (correctedInIso) update.corrected_clock_in = correctedInIso;
      // If the staff didn't correct the out time, use the just-recorded
      // clock-out — supervisors need a corrected pair to review a variance.
      update.corrected_clock_out = correctedOutIso ?? clockOut;
      update.edit_reason = reason.trim();
      update.review_status = "needs_review";
      update.edited_by = user.id;
      update.edited_at = clockOut;
      const auditEntry = {
        kind: "staff_correction_request",
        requested_by: user.id,
        requested_at: clockOut,
        from: {
          clock_in: active.clock_in_timestamp,
          clock_out: clockOut,
        },
        to: {
          clock_in: correctedInIso ?? active.clock_in_timestamp,
          clock_out: correctedOutIso ?? clockOut,
        },
        reason: reason.trim(),
      };
      // Append to edit_audit_history_log without clobbering existing entries.
      const { data: existing } = await supabase
        .from("evv_timesheets")
        .select("edit_audit_history_log")
        .eq("id", active.id)
        .maybeSingle();
      const prior = Array.isArray(existing?.edit_audit_history_log)
        ? (existing!.edit_audit_history_log as unknown[])
        : [];
      update.edit_audit_history_log = [...prior, auditEntry];
    }

    // ── Compliance gate: check confirmed billing_conflict rules against the
    // FULL set of codes committed for this client on this date, plus this
    // timesheet's code. Provider (admin/manager) decides via dialog; staff
    // is restricted — punch preserved, billable commit held.
    const serviceDateISO = clockOut.slice(0, 10);
    const orgId = org?.organization_id ?? "";
    const runFullCommit = async (): Promise<{ ok: true }> => {
      const { error } = await supabase
        .from("evv_timesheets")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(update as any)
        .eq("id", active.id);
      if (error) throw error;
      return { ok: true };
    };

    if (orgId) {
      const otherCodes = await gatherDayCommittedCodes(active.client_id, serviceDateISO, active.id);
      const allCodes = Array.from(
        new Set(
          [active.service_type_code, ...otherCodes]
            .filter(Boolean)
            .map((c) => String(c).toUpperCase()),
        ),
      );

      if (canOverrideCompliance) {
        // Admin/manager: dialog opens with acknowledge / stop.
        const gateResult = await evvComplianceGate(
          {
            clientId: active.client_id,
            serviceDate: serviceDateISO,
            serviceCodes: allCodes,
            staffId: user.id,
            timesheetId: active.id,
          },
          runFullCommit,
        );
        // On Stop: preserve punch (do NOT discard timestamp) and halt.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (gateResult && (gateResult as any).stopped) {
          await preservePunchOnly(clockOut, update);
          toast.message("Punch preserved. Billable commit halted per your compliance decision.");
          return;
        }
      } else {
        // Staff (no override): detect directly; if conflict, raise OPEN flags
        // for audit, preserve punch, and route to supervisor.

        const detected = (await detectBillingConflict({
          data: {
            organizationId: orgId,
            clientId: active.client_id,
            serviceDate: serviceDateISO,
            serviceCodes: allCodes,
            staffId: user.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        })) as {
          flags: Array<{
            ruleId: string;
            requirementId: string;
            matchedCodes: string[];
            source: { title: string; verbatim: string; citation: string | null };
          }>;
        };
        if (detected?.flags?.length) {
          for (const c of detected.flags) {
            try {
              await raiseComplianceFlagFn({
                data: {
                  organizationId: orgId,
                  ruleId: c.ruleId,
                  requirementId: c.requirementId,
                  detectionType: "billing_conflict",
                  subjectContext: {
                    timesheet_id: active.id,
                    client_id: active.client_id,
                    date: serviceDateISO,
                    staff_id: user.id,
                    source: "evv_close",
                    matchedCodes: c.matchedCodes,
                    restricted_for_role: role ?? "unknown",
                  },
                  sourceSnapshot: c.source,
                },
              });
            } catch {
              // Non-fatal: continue raising remaining flags.
            }
          }
          await preservePunchOnly(clockOut, update);
          toast.error(
            "Clock-out held for compliance review. Your punch time is saved — a supervisor must resolve the flagged conflict before this timesheet can be finalized.",
          );
          return;
        }
        // No conflict — proceed to normal commit below.
        await runFullCommit();
      }
    } else {
      // No org context — fall back to the raw update (legacy behavior).
      await runFullCommit();
    }

    // Persist any unresolved / dismissed-with-reason completeness flags for the admin Task Center.
    if (org?.organization_id && completenessFlags.length > 0) {
      const rows = completenessFlags
        .filter((f) => f.severity === "soft") // hard issues couldn't have gotten here
        .map((f) => ({
          organization_id: org.organization_id,
          shift_id: active.id,
          client_id: active.client_id,
          staff_id: user.id,
          flag_type: f.type,
          severity: f.severity,
          message: f.message,
          fix_route: f.fix?.route ?? null,
          status: dismissals[f.key] ? "dismissed_with_reason" : "pending",
          dismissal_reason: dismissals[f.key] ?? null,
        }));
      if (rows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase.from("shift_completeness_flags").insert(rows as any);
      }
    }

    // Persist post-shift Behavior Observations when the provider has the feature on.
    if (behaviorEnabled && org?.organization_id) {
      const b = behaviorAnswers;
      const obs = {
        organization_id: org.organization_id,
        shift_id: active.id,
        client_id: active.client_id,
        staff_id: user.id,
        observed_at: clockOut,
        behaviors_observed: b.behaviorsObserved === true,
        target_behaviors: b.behaviorsObserved ? b.targetBehaviors : [],
        behavior_counts: b.behaviorsObserved ? b.counts : {},
        objective_description: b.behaviorsObserved ? b.objectiveDescription.trim() || null : null,
        antecedent_context: b.behaviorsObserved ? b.antecedentContext.trim() || null : null,
        intervention_response: b.behaviorsObserved ? b.interventionResponse.trim() || null : null,
        reportable_incident: b.behaviorsObserved ? b.reportableIncident : false,
        positives: b.positives.trim() || null,
        trend_vs_recent: b.trendVsRecent || null,
      };
      const { error: behErr } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("shift_behavior_observations" as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(obs as any, { onConflict: "shift_id" });
      if (behErr) {
        // Non-blocking: shift is already saved. Surface a soft toast.
        toast.error(`Behavior observations not saved: ${behErr.message}`);
      }
    }

    // Medication compliance is now recorded in the real MAR (`emar_logs`) via
    // the eMAR tab — no shadow attestation write here.

    const displayIn = args.correction?.correctedInIso ?? active.clock_in_timestamp;
    const displayOut = args.correction?.correctedOutIso ?? clockOut;
    const duration = fmtElapsed(
      Math.max(0, new Date(displayOut).getTime() - new Date(displayIn).getTime()),
    );
    setShowCompliance(false);
    setOutVariance(null);
    setOutVarianceReason("");
    setSuccess({
      duration,
      evvClean: !args.outsideReason && !args.correction,
      correctionSubmitted: !!args.correction,
      awaitingApproval: !!args.correction || !!args.outsideReason,
    });
    await invalidateStaffCaseloadWork(qc);
  }

  async function submitCompliance() {
    if (!user || !active) return;
    if (!hasGoalSelected) {
      toast.error("Select at least one PCSP goal or baseline monitoring.");
      return;
    }
    if (!narrativeOk) {
      setShowNarrativeError(true);
      setCompletenessErrors([localWordCountCheck(narrative)]);
      return;
    }
    if (behaviorEnabled && behaviorError) {
      toast.error(`Behavior observations: ${behaviorError}`);
      return;
    }
    if (!triggersResolved) {
      toast.error("Resolve the NECTAR trigger(s) in your note before submitting.");
      return;
    }
    if (!medDosesResolved) {
      toast.error("Log all scheduled medication doses in eMAR before submitting.");
      return;
    }
    if (nectarUsed && !nectarAssistChecked) {
      toast.error("You used NECTAR on this punch — attest that you reviewed the draft.");
      return;
    }
    if (!attestationChecked) {
      toast.error("Attest that the note and time punch are accurate before clocking out.");
      return;
    }
    if (correctionOpen && correctionHasChange && !correctionValid) {
      if (!correctionReasonOk) {
        toast.error("Add a short reason (at least 10 characters) for the correction.");
      } else if (!correctionOrderOk) {
        toast.error("Corrected clock-out must be after the corrected clock-in.");
      } else if (!correctionWithinWindow) {
        toast.error("Correction times are outside the allowed window for this shift.");
      } else {
        toast.error("Fix the time-correction fields before submitting.");
      }
      return;
    }
    const correctionPayload =
      correctionOpen && correctionHasChange
        ? {
            correctedInIso: correctionInIso,
            correctedOutIso: correctionOutIso,
            reason: correctionReason,
          }
        : undefined;
    // Hard gate: if staff toggled the clock-out incident flag (or a Nectar
    // trigger fired), require a SUBMITTED Incident Report on this shift.
    if (incidentFlag && incidentReportIds.length === 0) {
      toast.error(
        "You marked an incident — submit the Incident Report before submitting the timesheet.",
      );
      setIncidentDialogOpen(true);
      return;
    }

    // NECTAR Completeness Check (Infusion only). Without infusion, basic field
    // validation above is sufficient — the cross-checks are the locked layer.
    if (nectarInfusionEnabled) {
      let flags = completenessFlags;
      if (!completenessRan) {
        flags = await runCompletenessCheck();
      }
      const hardOpen = flags.some((f) => f.severity === "hard");
      const softOpen = flags.some((f) => f.severity === "soft" && !dismissals[f.key]);
      if (hardOpen) {
        toast.error("Fix the required items flagged by NECTAR before submitting.");
        return;
      }
      if (softOpen) {
        toast.error("Resolve or dismiss-with-reason each NECTAR completeness flag.");
        return;
      }
    }

    // One completeness gate on Submit: local 30-word check, then NECTAR for
    // client / support / response. Fail stays on the form. No exception path.
    let aiVerdictFeedback = COMPLETENESS_PASS_FEEDBACK;
    setAiBusy(true);
    try {
      const selectedGoalsForAi = Object.entries(checkedGoals)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (baselineChecked)
        selectedGoalsForAi.push("General baseline monitoring & safety oversight");

      const clientFirst =
        lockedClient?.name?.split(" ")?.[0] ??
        caseload.find((c) => c.id === active.client_id)?.first_name ??
        "the client";

      const verdict = await evaluateShiftNote({
        data: {
          narrative: narrative.trim(),
          goals: selectedGoalsForAi,
          clientFirstName: clientFirst,
          serviceCode: active.service_type_code,
        },
      });
      if (verdict.status !== "Verified") {
        setCompletenessErrors(verdict.checks.filter((c) => !c.passed));
        return;
      }
      setCompletenessErrors([]);
      aiVerdictFeedback = verdict.feedback || COMPLETENESS_PASS_FEEDBACK;
    } catch (e) {
      const errMsg = (e as Error).message ?? "";
      setCompletenessErrors([
        {
          key: "support_provided",
          passed: false,
          message:
            errMsg || "NECTAR could not check this note. Fix nothing yet — tap Submit again.",
        },
      ]);
      return;
    } finally {
      setAiBusy(false);
    }

    const aiStatusForRow = "Verified" as const;
    const aiFeedbackForRow = aiVerdictFeedback;

    setBusy(true);
    try {
      const isEvv = isEvvLockedCode(active.service_type_code);

      // Computed up front (no pos dependency) so the GPS-unavailable bypass
      // path below can offer the same radius context as the geofence dialog.
      const refClient =
        lockedClient ??
        (() => {
          const c = caseload.find((x) => x.id === active.client_id);
          if (!c) return null;
          return {
            homeLat: c.home_latitude ?? null,
            homeLng: c.home_longitude ?? null,
            geofenceRadiusFeet: c.geofence_radius_feet ?? null,
          } as Pick<LockedClient, "homeLat" | "homeLng" | "geofenceRadiusFeet">;
        })();

      const lat = refClient?.homeLat;
      const lng = refClient?.homeLng;
      const radius = resolveGeofenceRadiusFeet(refClient?.geofenceRadiusFeet);

      // Sequence GPS acquisition: fail-closed until a high-accuracy fix.
      let pos = livePos;
      if (!gpsConfident) {
        if (hardwareDenied) {
          toast.error(
            "Location is blocked. Enable location for this site in device Settings, then retry. Clock-out is held until GPS is captured.",
          );
          return;
        }
        pos = await waitForConfidentFix();
        if (!pos) {
          toast.error(
            "No GPS fix yet. Wait for high-accuracy GPS and retry — clock-out is held until a live location is captured.",
          );
          return;
        }
        if (!isGpsFixConfident(pos)) {
          toast.error(
            `GPS is too coarse (±${Math.round(pos.acc)} m) to confirm the saved home pin. Wait for a better fix and retry — this is not an out-of-zone variance.`,
          );
          return;
        }
      }

      // Symmetric geofence check on clock-out — EVV-locked codes only.
      if (pos && isEvv) {
        const decision = evaluateGeofence({
          home: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null,
          live: pos,
          accuracyMeters: pos.acc,
          radiusFeet: radius,
        });
        if (decision.kind === "outside") {
          const matchedOut = matchApprovedLocation({ lat: pos.lat, lng: pos.lng });
          if (!matchedOut) {
            setOutVariance({
              distanceFeet: Math.round(decision.distanceFeet),
              limitFeet: decision.limitFeet,
              pos,
            });
            setOutVarianceReason("");
            return;
          }
        }
      }

      // Stage 5 — required_before_clockout front-guard. READ-ONLY against
      // evv_timesheets; ALWAYS fail-open. Runs BEFORE finalizeClockOut;
      // finalizeClockOut's update object is unchanged.
      if (active) {
        const pendingOut = await fetchPendingTrackingForms({
          tier: "clockout",
          shiftId: active.id,
          clientId: active.client_id,
          serviceCode: active.service_type_code,
        });
        if (pendingOut.length) {
          const finalize = () =>
            finalizeClockOut({
              pos,
              aiStatus: aiStatusForRow,
              aiFeedback: aiFeedbackForRow,
              aiIterationCount: 1,
              correction: correctionPayload,
            });
          setPendingFormsDialog({
            mode: "clockout",
            pending: pendingOut,
            proceed: async () => {
              setPendingFormsDialog(null);
              setBusy(true);
              try {
                await finalize();
              } finally {
                setBusy(false);
              }
            },
            recheck: async () => {
              const again = await fetchPendingTrackingForms({
                tier: "clockout",
                shiftId: active.id,
                clientId: active.client_id,
                serviceCode: active.service_type_code,
              });
              if (!again.length) {
                setPendingFormsDialog(null);
                setBusy(true);
                try {
                  await finalize();
                } finally {
                  setBusy(false);
                }
              } else {
                setPendingFormsDialog((p) => (p ? { ...p, pending: again } : p));
              }
            },
          });
          return;
        }
      }

      await finalizeClockOut({
        pos,
        aiStatus: aiStatusForRow,
        aiFeedback: aiFeedbackForRow,
        aiIterationCount: 1,
        correction: correctionPayload,
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not end shift.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOutVariance() {
    if (!outVariance) return;
    const reason = outVarianceReason.trim();
    if (reason.length < 5) {
      toast.error("Please provide a variance justification.");
      return;
    }
    // Truly no GPS (denied/no fix) → GPS-bypass path (address fallback at
    // export time), distinct from a geofence out-of-bounds variance.
    const isBypass = !!outVariance.frameBlocked;
    setBusy(true);
    try {
      // Stage 5 — fail-open clock-out guard for the variance path too.
      if (active) {
        const pendingOut = await fetchPendingTrackingForms({
          tier: "clockout",
          shiftId: active.id,
          clientId: active.client_id,
          serviceCode: active.service_type_code,
        });
        if (pendingOut.length) {
          const pos = outVariance.pos;
          const outside = reason;
          const finalize = () =>
            finalizeClockOut(
              isBypass ? { pos, gpsBypassReason: outside } : { pos, outsideReason: outside },
            );
          setPendingFormsDialog({
            mode: "clockout",
            pending: pendingOut,
            proceed: async () => {
              setPendingFormsDialog(null);
              setBusy(true);
              try {
                await finalize();
              } finally {
                setBusy(false);
              }
            },
            recheck: async () => {
              const again = await fetchPendingTrackingForms({
                tier: "clockout",
                shiftId: active.id,
                clientId: active.client_id,
                serviceCode: active.service_type_code,
              });
              if (!again.length) {
                setPendingFormsDialog(null);
                setBusy(true);
                try {
                  await finalize();
                } finally {
                  setBusy(false);
                }
              } else {
                setPendingFormsDialog((p) => (p ? { ...p, pending: again } : p));
              }
            },
          });
          return;
        }
      }

      await finalizeClockOut(
        isBypass
          ? { pos: outVariance.pos, gpsBypassReason: reason }
          : { pos: outVariance.pos, outsideReason: reason },
      );
    } catch (e) {
      toast.error((e as Error).message || "Could not end shift.");
    } finally {
      setBusy(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  const elapsed = (() => {
    if (correctionOpen && correctionHasChange && Number.isFinite(effectiveInMs)) {
      return fmtElapsed(Math.max(0, effectiveOutMs - effectiveInMs));
    }
    if (activeMatchesThisPad) {
      return fmtElapsed(now - new Date(active!.clock_in_timestamp).getTime());
    }
    return "00:00:00";
  })();
  const isRunning = !!activeMatchesThisPad;
  const endIsEvv = isEvvLockedCode(active?.service_type_code ?? "");
  const startIsEvv = isEvvLockedCode(serviceCode);
  const padAriaLabel = isRunning
    ? endIsEvv
      ? "EVV Shift Punch Pad"
      : "Time Clock"
    : startIsEvv
      ? "EVV Shift Punch Pad"
      : "Time Clock";

  return (
    <EvvConsentGate>
      <section
        aria-label={padAriaLabel}
        className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        {/* ── Header ── */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 animate-pulse rounded-full ${isRunning ? "bg-emerald-500" : "bg-rose-500"}`}
              aria-hidden
            />
            <span className="text-sm font-semibold uppercase tracking-wider">
              {isRunning ? "🟢 On the Shift" : "🔴 Out of Clock"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isEvvLockedCode(serviceCode) && gpsAcquiring && !hardwareDenied && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] text-amber-600 border-amber-400"
              >
                <Wifi className="h-3 w-3 animate-pulse" /> Acquiring GPS
              </Badge>
            )}
            {isEvvLockedCode(serviceCode) && !gpsAcquiring && livePos && gpsConfident && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] text-emerald-600 border-emerald-400"
              >
                <MapPin className="h-3 w-3" /> GPS Live
              </Badge>
            )}
            {isEvvLockedCode(serviceCode) && !hardwareDenied && livePos && !gpsConfident && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] text-amber-600 border-amber-400"
              >
                <Wifi className="h-3 w-3" /> GPS coarse
              </Badge>
            )}
            {isEvvLockedCode(serviceCode) && hardwareDenied && (
              <Badge variant="outline" className="gap-1 text-[10px] text-rose-600 border-rose-400">
                <AlertTriangle className="h-3 w-3" /> GPS Blocked
              </Badge>
            )}
          </div>
        </header>

        {/* ── Locked client banner ── */}
        {lockedClient && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4" /> Serving: {lockedClient.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Verified Medicaid ID:{" "}
              <span className="font-mono">{maskMemberId(lockedClient.memberId) || "—"}</span>
              {typeof lockedClient.geofenceRadiusFeet === "number" && (
                <>
                  {" "}
                  · Geofence:{" "}
                  <span className="font-mono">{lockedClient.geofenceRadiusFeet} ft</span>
                </>
              )}
            </p>
          </div>
        )}

        {/* ── Launchpad clock-in gate (pre-clock-in only) ── */}
        {!isRunning && launchpadBlocked && (
          <div
            data-testid="launchpad-gate-block"
            className="mb-4 rounded-lg border border-amber-400/60 bg-amber-50 px-3 py-3"
            role="alert"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-[#1A2B47]">
              <Lock className="h-4 w-4 text-amber-700" />
              Launchpad required before clock-in
            </p>
            <p className="mt-1 text-[12px] leading-snug text-[#1A2B47]/90">
              {LAUNCHPAD_CLOCK_IN_BLOCKED_MESSAGE}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to="/dashboard/hive-training"
                className="inline-flex items-center rounded-md bg-[#1A2B47] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1A2B47]/90"
              >
                Open Training
              </Link>
              <Link
                to="/dashboard/my-obligations"
                className="inline-flex items-center rounded-md border border-[#1A2B47]/30 px-2.5 py-1 text-xs font-semibold text-[#1A2B47] hover:bg-white"
              >
                Staff file
              </Link>
            </div>
          </div>
        )}

        {/* ── NECTAR Shift Pre-Flight (pre-clock-in only) ── */}
        {!isRunning && clientForPunch && serviceCode && (
          <NectarInfusionLock
            featureName="Shift pre-flight"
            benefit="NECTAR tells you up front what this shift will need at clock-out — so end-of-shift isn't a surprise."
            className="mb-4"
          >
            <div className="rounded-lg border border-[color:var(--amber-300)] bg-[color:var(--amber-50)]/70 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-700)]">
                <PiMark className="h-3.5 w-3.5" /> NECTAR · Pre-flight
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[color:var(--navy-900)]">
                <span className="font-semibold">
                  {serviceCode} shift with {clientForPunch.name.split(" ")[0]}
                </span>{" "}
                — at clock-out you'll need:
              </p>
              <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-[color:var(--navy-900)]/90">
                <li>• A progress note (50-word minimum, objective)</li>
                <li>
                  • At least one PCSP goal checked
                  {clientForPunch.pcspGoals?.length
                    ? ` (${clientForPunch.pcspGoals.length} on file)`
                    : " (none on file — ask your supervisor)"}
                </li>
                {isEvvLockedCode(serviceCode) && (
                  <li>• In-radius clock-out, or a written variance</li>
                )}
                <li>• Any spending or reimbursement entries logged before submitting</li>
              </ul>
              <p className="mt-1.5 text-[11px] text-[color:var(--navy-900)]/70">
                Tip: you can dictate the note by voice at clock-out.
              </p>
            </div>
          </NectarInfusionLock>
        )}

        {/* ── GPS status strip (clock-in only, no map) ── */}
        {!isRunning && (
          <div className={`mb-4 rounded-lg border p-3 text-xs leading-relaxed ${gpsStripClass}`}>
            {gpsAcquiring && !hardwareDenied ? (
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {gpsStatusLabel.text}
              </p>
            ) : (
              <p>{gpsStatusLabel.text}</p>
            )}
          </div>
        )}

        {/* ── Controls ── */}
        <div className="grid gap-3">
          {entryType === "General_Sidebar_Unscheduled" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  🏢 Assign Facility / House Site
                </label>
                <Select
                  value={selectedFacility}
                  onValueChange={setSelectedFacility}
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.length === 0 && (
                      <SelectItem value="__none" disabled>
                        No facilities on file
                      </SelectItem>
                    )}
                    {facilities.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  👤 Assign Client Individual
                </label>
                <Select
                  value={selectedClientId}
                  onValueChange={(v) => {
                    setSelectedClientId(v);
                    setServiceCode("");
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {caseload
                      .filter((c) => !selectedFacility || c.physical_address === selectedFacility)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                          {c.medicaid_id ? ` · #${maskMemberId(c.medicaid_id)}` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {clientForPunch && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Member ID:{" "}
                    <span className="font-mono">
                      {maskMemberId(clientForPunch.memberId) || "missing"}
                    </span>
                  </p>
                )}
              </div>
            </>
          )}

          {!isRunning && (
            <div>
              <label className="mb-1 block text-xs font-medium">💼 Select Service Code</label>
              <Select
                value={serviceCode}
                onValueChange={setServiceCode}
                disabled={isRunning || !clientForPunch || (lockServiceCode && !!presetServiceCode)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue
                    placeholder={clientForPunch ? "Select authorized code" : "Pick a client first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {codesForClient.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No codes authorized
                    </SelectItem>
                  ) : (
                    codesForClient.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {lockServiceCode && presetServiceCode ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-accent">
                  <Lock className="h-3 w-3" />
                  Locked from today&apos;s schedule — prevents billing errors.
                </p>
              ) : clientForPunch?.authorizedCodes?.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Restricted to authorizations on {clientForPunch.name}&apos;s profile.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Elapsed timer ── */}
        <div className="mt-5 flex items-center justify-center rounded-xl border border-border bg-background/70 py-3">
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
            {elapsed}
          </span>
        </div>

        {/* ── Clock buttons ── */}
        {isRunning ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={openCompliance}
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-base font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-700 disabled:opacity-60"
              aria-label={endIsEvv ? "End EVV Shift" : "Clock Out"}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Square className="h-5 w-5 fill-current" />{" "}
                  {endIsEvv ? "END EVV SHIFT" : "CLOCK OUT"}
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={handleClockIn}
                disabled={busy || !inReady || launchpadBlocked}
                className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:scale-[1.02] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={startIsEvv ? "Start EVV Shift" : "Clock In"}
                data-testid="clock-in-button"
              >
                {busy ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : (
                  <Play className="h-10 w-10 fill-current" />
                )}
              </button>
            </div>
            <p className="mt-3 text-center text-sm font-semibold uppercase tracking-wider">
              {startIsEvv ? "▶️ START EVV SHIFT" : "▶️ CLOCK IN"}
            </p>
          </>
        )}

        <PunchPadProceduralAsk
          clientFirstName={
            lockedClient?.name?.split(" ")?.[0] ??
            caseload.find((client) => client.id === (active?.client_id ?? selectedClientId))
              ?.first_name ??
            "this client"
          }
          serviceCode={serviceCode}
          pcspGoals={lockedClient?.pcspGoals ?? []}
        />

        {/* ════════════════════════════════════════════════════════════════════
            DIALOGS
        ════════════════════════════════════════════════════════════════════ */}

        {/* Stage 5 — per-shift tracking-form front-guard dialog */}
        <PendingTrackingFormsDialog
          open={!!pendingFormsDialog}
          mode={pendingFormsDialog?.mode ?? "clockout"}
          pending={pendingFormsDialog?.pending ?? []}
          busy={busy}
          onClose={() => setPendingFormsDialog(null)}
          onProceedAfterRecheck={
            pendingFormsDialog ? () => pendingFormsDialog.recheck() : undefined
          }
          onSkipWithReason={
            pendingFormsDialog?.mode === "clockout"
              ? async (skipReason) => {
                  // Sole write from the guard: shift_completeness_flags row(s).
                  // evv_timesheets is NOT written here.
                  if (org?.organization_id && user && active && pendingFormsDialog) {
                    const rows = pendingFormsDialog.pending.map((p) => ({
                      organization_id: org.organization_id,
                      shift_id: active.id,
                      client_id: active.client_id,
                      staff_id: user.id,
                      flag_type: "tracking_form_missing",
                      severity: "soft",
                      message: `Required tracking form "${p.formName}" skipped at clock-out.`,
                      status: "dismissed_with_reason",
                      dismissal_reason: skipReason,
                    }));
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await supabase.from("shift_completeness_flags").insert(rows as any);
                    } catch {
                      // Best-effort; never trap caregiver because of flag insert.
                    }
                  }
                  await pendingFormsDialog?.proceed();
                }
              : undefined
          }
        />

        <GeofenceVarianceDialog
          mode="clock-in"
          variance={variance}
          reason={varianceReason}
          busy={busy}
          onReasonChange={setVarianceReason}
          onCancel={() => {
            setVariance(null);
            setVarianceReason("");
          }}
          onConfirm={() => void submitVariance()}
        />
        <GeofenceVarianceDialog
          mode="clock-out"
          variance={outVariance}
          reason={outVarianceReason}
          busy={busy}
          onReasonChange={setOutVarianceReason}
          onCancel={() => {
            setOutVariance(null);
            setOutVarianceReason("");
          }}
          onConfirm={() => void submitOutVariance()}
        />

        {/* Clock-IN success confirmation */}
        <Dialog
          open={!!clockInSuccess}
          onOpenChange={(o) => {
            if (!o) setClockInSuccess(null);
          }}
        >
          <DialogContent className="overflow-hidden p-0">
            <div
              className={`px-6 py-5 ${clockInSuccess?.evvClean ? "bg-emerald-50 dark:bg-emerald-950" : "bg-amber-50 dark:bg-amber-950"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${clockInSuccess?.evvClean ? "bg-emerald-500" : "bg-amber-500"}`}
                >
                  {clockInSuccess?.evvClean ? (
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  ) : (
                    <AlertTriangle className="h-7 w-7 text-white" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-base font-bold ${clockInSuccess?.evvClean ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
                  >
                    {clockInSuccess?.evvClean
                      ? "✅ EVV Clock-In Confirmed"
                      : "⚠️ Shift Started with Variance"}
                  </p>
                  <p
                    className={`text-xs ${clockInSuccess?.evvClean ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
                  >
                    {clockInSuccess?.evvClean
                      ? "GPS verified · Location confirmed · Timesheet saved in PI"
                      : "Variance logged · Pending admin review · Timesheet saved in PI"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm text-muted-foreground">
                {clockInSuccess?.evvClean
                  ? `Your shift serving ${clockInSuccess.clientName} has started. GPS coordinates have been captured and your timesheet is now active. State EVV is an admin CSV export — this punch is not sent to DHHS automatically.`
                  : `Your shift serving ${clockInSuccess?.clientName} has started with a geofence variance on file. Your written justification has been recorded and an administrator will review the variance flag on this timesheet. State EVV is an admin CSV export — this punch is not sent to DHHS automatically.`}
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => setClockInSuccess(null)}
                  className={
                    clockInSuccess?.evvClean
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }
                >
                  Got it — Start Shift
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clock-OUT success confirmation */}
        <Dialog
          open={!!success}
          onOpenChange={(o) => {
            if (!o) {
              setSuccess(null);
              navigate({ to: "/dashboard" });
            }
          }}
        >
          <DialogContent className="overflow-hidden p-0">
            <div
              className={`px-6 py-5 ${success?.evvClean ? "bg-emerald-50 dark:bg-emerald-950" : "bg-amber-50 dark:bg-amber-950"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${success?.evvClean ? "bg-emerald-500" : "bg-amber-500"}`}
                >
                  {success?.evvClean ? (
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  ) : (
                    <AlertTriangle className="h-7 w-7 text-white" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-base font-bold ${success?.evvClean ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
                  >
                    {success?.correctionSubmitted
                      ? "Correction request submitted"
                      : success?.evvClean
                        ? "Shift successfully closed"
                        : "Shift closed with variance"}
                  </p>
                  <p
                    className={`text-xs ${success?.evvClean ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
                  >
                    {success?.correctionSubmitted
                      ? "Your supervisor will review the corrected times before this shift bills."
                      : success?.evvClean
                        ? "GPS verified · Documentation complete · Submitted to EVV"
                        : "Variance logged · Pending admin review · Submitted to EVV"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Duration
                </span>
                <span className="font-mono text-lg font-bold tabular-nums">
                  {success?.duration}
                </span>
              </div>
              {success?.awaitingApproval ? (
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Awaiting supervisor approval. These hours use the time you submitted, not the
                  original raw clock span.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {success?.correctionSubmitted
                  ? "The shift is held for supervisor review. You can track its status on My timesheets from the Caseload Nectar pay card. If approved, the corrected times replace the recorded times for billing; if denied, you'll see the reviewer's note there."
                  : success?.evvClean
                    ? "Your timesheet has been submitted to Records review for administrative sign-off. No further action required."
                    : "Your timesheet has been submitted with a variance flag. An administrator will review the out-of-bounds justification before final approval."}
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setSuccess(null);
                    navigate({ to: "/dashboard" });
                  }}
                  className={
                    success?.evvClean
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }
                >
                  Back to My Caseload
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clock-Out Compliance Modal */}
        <Dialog
          open={showCompliance}
          onOpenChange={(o) => {
            if (!busy) setShowCompliance(o);
          }}
        >
          <DialogContent
            className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:w-full"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
              <DialogTitle className="pr-8 text-base sm:text-lg">
                Shift Verification &amp; Medicaid Compliance Form
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Complete the goals tracker and progress note below to submit your timesheet.
              </DialogDescription>
              {/* Live elapsed — pinned at top */}
              <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Live Duration
                </span>
                <span className="font-mono text-base font-bold tabular-nums sm:text-lg">
                  {elapsed}
                </span>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-6 sm:px-6">
              <div className="grid gap-4">
                <PunchPadGoalsSection
                  goals={activeClientGoals}
                  checkedGoals={checkedGoals}
                  baselineChecked={baselineChecked}
                  hasGoalSelected={hasGoalSelected}
                  onGoalChange={(goal, checked) =>
                    setCheckedGoals((current) => ({
                      ...current,
                      [goal]: checked,
                    }))
                  }
                  onBaselineChange={setBaselineChecked}
                />

                <PunchPadNoteSection
                  goals={activeClientGoals}
                  selectedGoals={[
                    ...Object.entries(checkedGoals)
                      .filter(([, selected]) => selected)
                      .map(([goal]) => goal),
                    ...(baselineChecked ? ["General baseline monitoring & safety oversight"] : []),
                  ]}
                  clientFirstName={
                    lockedClient?.name?.split(" ")?.[0] ??
                    caseload.find((client) => client.id === active?.client_id)?.first_name ??
                    "the client"
                  }
                  narrative={narrative}
                  originalTranscript={originalTranscript}
                  wordCount={wordCount}
                  narrativeOk={narrativeOk}
                  showNarrativeError={showNarrativeError}
                  completenessErrors={completenessErrors}
                  onNarrativeChange={setNarrative}
                  onOriginalTranscriptChange={setOriginalTranscript}
                  onClearValidationErrors={() => {
                    if (showNarrativeError) setShowNarrativeError(false);
                    if (completenessErrors.length) setCompletenessErrors([]);
                  }}
                  onDraftApplied={setNectarDraftApplied}
                  onNectarUsed={() => setNectarUsed(true)}
                />

                {active && (
                  <PunchPadShiftSignals
                    shiftId={active.id}
                    clientId={active.client_id}
                    clientName={active.client_name ?? "this client"}
                    organizationId={org?.organization_id}
                    clockInIso={active.clock_in_timestamp}
                    narrative={narrative}
                    incidentAnswer={incidentAnswer}
                    incidentReportIds={incidentReportIds}
                    incidentDialogOpen={incidentDialogOpen}
                    incidentTriggerOpen={incidentTriggerOpen}
                    behaviorEnabled={behaviorEnabled}
                    behaviorAnswers={behaviorAnswers}
                    targetBehaviorOptions={targetBehaviorOptions}
                    onIncidentAnswer={(answer) => {
                      setIncidentAnswer(answer);
                      setIncidentFlag(answer === "yes");
                    }}
                    onIncidentDialogOpenChange={setIncidentDialogOpen}
                    onIncidentTriggerOpenChange={setIncidentTriggerOpen}
                    onIncidentSubmitted={(id) => {
                      setIncidentReportIds((previous) =>
                        previous.includes(id) ? previous : [...previous, id],
                      );
                      setIncidentFlag(true);
                      setIncidentAnswer("yes");
                      void qc.invalidateQueries({
                        queryKey: [
                          "incident-submitted-for",
                          active.client_id,
                          new Date().toISOString().slice(0, 10),
                        ],
                      });
                    }}
                    onAppointmentTriggered={() => {
                      navigate({
                        to: `/dashboard/workspace/${active.client_id}`,
                      });
                      toast.message("Opened client workspace — log the appointment, then return.");
                    }}
                    onTriggersResolved={setTriggersResolved}
                    onBehaviorChange={setBehaviorAnswers}
                    onMedResolvedChange={setMedDosesResolved}
                    onPendingDosesChange={setPendingMedDoses}
                  />
                )}

                <PunchPadCompletenessPanel
                  ran={completenessRan}
                  busy={completenessBusy}
                  flags={completenessFlags}
                  dismissals={dismissals}
                  dismissingKey={dismissingKey}
                  dismissReason={dismissReasonDraft}
                  onRun={() => void runCompletenessCheck()}
                  onJumpToFix={jumpToFix}
                  onStartDismiss={(key) => {
                    setDismissingKey(key);
                    setDismissReasonDraft("");
                  }}
                  onCancelDismiss={() => {
                    setDismissingKey(null);
                    setDismissReasonDraft("");
                  }}
                  onDismissReasonChange={setDismissReasonDraft}
                  onConfirmDismiss={confirmDismiss}
                />

                {/* Long-shift acknowledgement / correction request — lives in
                    the scrollable area so a growing correction panel never
                    pushes the submit button off-screen. */}
                {isLongShift && !correctionOpen && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-2">
                        <p>
                          This shift shows{" "}
                          <span className="font-mono font-semibold">{elapsed}</span>. If you forgot
                          to clock out or the times are wrong, request a time correction below
                          instead of confirming these times.
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <label
                            className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md border px-2 text-xs font-medium ${
                              longShiftAck ? selectedPill : unselectedPill
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-[color:var(--amber-600)]"
                              checked={longShiftAck}
                              onChange={(e) => setLongShiftAck(e.target.checked)}
                            />
                            These times are accurate
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => active && openCorrectionPanel(active)}
                            className="h-8 border-[color:var(--amber-600)]/60 text-[color:var(--amber-700)] hover:bg-[color:var(--amber-50)]"
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Request time correction
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!correctionOpen && !isLongShift && active && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openCorrectionPanel(active)}
                      className="h-8 border-[color:var(--amber-600)]/60 text-[color:var(--amber-700)] hover:bg-[color:var(--amber-50)]"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Request time correction
                    </Button>
                  </div>
                )}

                {correctionOpen && active && (
                  <div className="rounded-md border border-amber-500/60 bg-amber-500/5 p-3 text-sm">
                    <div className="mb-2 flex items-start gap-2">
                      <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Request a time correction
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Enter what your clock-in and/or clock-out should have been. Your
                          supervisor reviews the request and either approves the corrected times
                          (they become the billable times) or denies it with a note.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] font-medium">Corrected clock-in</Label>
                        <input
                          type="datetime-local"
                          value={correctionIn}
                          onChange={(e) => setCorrectionIn(e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Recorded:{" "}
                          {new Date(active.clock_in_timestamp).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium">Corrected clock-out</Label>
                        <input
                          type="datetime-local"
                          value={correctionOut}
                          onChange={(e) => setCorrectionOut(e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Recorded: about to be set to now (
                          {new Date(now).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          ).
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Label className="text-[11px] font-medium">
                        Reason (visible to your supervisor)
                      </Label>
                      <Textarea
                        rows={2}
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        placeholder="e.g. I forgot to clock out — I actually left at 6:15 PM. Or: I clocked in ~15 min late; started at 8:00 AM."
                        className="mt-1 min-h-[60px] text-sm"
                      />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {correctionReason.trim().length} / 10 min characters
                      </p>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setCorrectionOpen(false);
                          setCorrectionIn("");
                          setCorrectionOut("");
                          setCorrectionReason("");
                        }}
                      >
                        Cancel correction
                      </Button>
                    </div>
                  </div>
                )}

                {nectarUsed && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
                        checked={nectarAssistChecked}
                        onChange={(e) => setNectarAssistChecked(e.target.checked)}
                      />
                      <span className="leading-relaxed text-amber-900 dark:text-amber-100">
                        I used NECTAR to help draft this note. I reviewed the draft and confirm it
                        is accurate.
                      </span>
                    </label>
                  </div>
                )}

                {/* Staff attestation — always visible, gates submission */}
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
                      checked={attestationChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAttestationChecked(checked);
                        if (checked && !attestationTimestamp) {
                          setAttestationTimestamp(new Date().toISOString());
                        }
                      }}
                    />
                    <span className="leading-relaxed text-amber-900 dark:text-amber-100">
                      I attest that this shift note is accurate and truthful, that it reflects
                      services I personally provided, and that I understand submitting false
                      Medicaid documentation constitutes fraud.
                    </span>
                  </label>
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Warning: Falsification of Medicaid service records is a federal offense under 18
                    U.S.C. § 1347 and may result in exclusion, civil penalties, and criminal
                    prosecution.
                  </p>
                  {attestationChecked && attestationTimestamp && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Attested at{" "}
                      {new Date(attestationTimestamp).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      on{" "}
                      {new Date(attestationTimestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <PunchPadSubmitFooter
              hardwareDenied={hardwareDenied}
              awaitingGps={awaitingGps}
              livePos={livePos}
              gpsConfident={gpsConfident}
              canSubmit={canSubmitCompliance}
              busy={busy}
              aiBusy={aiBusy}
              narrativeOk={narrativeOk}
              correctionRequested={correctionOpen && correctionHasChange}
              onNarrativeError={() => setShowNarrativeError(true)}
              onSubmit={() => void submitCompliance()}
            />
          </DialogContent>
        </Dialog>

        {/* NECTAR compliance flag dialog (admin/manager only; staff is restricted upstream). */}
        {complianceDialogEl}
        {clockInComplianceDialogEl}
      </section>
    </EvvConsentGate>
  );
}
