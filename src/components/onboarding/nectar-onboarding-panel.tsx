import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ArrowRight,
  Hexagon,
  Sparkles,
  Building2,
  Users,
  UserSquare2,
  Settings as SettingsIcon,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { OnboardingPipelineCard } from "@/components/company-overview/onboarding-pipeline-card";
import {
  notifyOnboardingChanged,
  useOnboardingProgress,
} from "@/hooks/use-onboarding-progress";
import { dismissAdminWelcome } from "@/lib/admin-home-welcome.functions";
import { cn } from "@/lib/utils";

const SERVICE_OPTIONS = ["HHS", "SLN", "SLH", "SEI", "DSI", "RHS"] as const;
type Service = (typeof SERVICE_OPTIONS)[number];

type ProfileDraft = {
  services: Service[];
  clientCount: string;
  staffCount: string;
  serviceArea: string;
  specializations: string;
};

const EMPTY_PROFILE: ProfileDraft = {
  services: [],
  clientCount: "",
  staffCount: "",
  serviceArea: "",
  specializations: "",
};

function lsKey(orgId: string, suffix: string) {
  return `hive_onboarding_${orgId}_${suffix}`;
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function NectarOnboardingPanel({
  welcomeFlag = false,
}: {
  welcomeFlag?: boolean;
}) {
  const { data: org } = useCurrentOrg();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dismissWelcome = useServerFn(dismissAdminWelcome);
  const orgId = org?.organization_id;
  const orgName = org?.organization_name ?? "your agency";
  const userMeta = (user?.user_metadata ?? {}) as { first_name?: string; full_name?: string };
  const adminFirstName =
    userMeta.first_name ||
    userMeta.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const [dismissedNow, setDismissedNow] = useState(false);
  const [profileSavedLocal, setProfileSavedLocal] = useState(false);
  const [servicesVisited, setServicesVisited] = useState(false);
  const [docsSkippedLocal, setDocsSkippedLocal] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [activeStepOverride, setActiveStepOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setProfileSavedLocal(readLS(lsKey(orgId, "profile_saved"), false));
    setServicesVisited(readLS(lsKey(orgId, "services_visited"), false));
    setDocsSkippedLocal(readLS(lsKey(orgId, "docs_skipped"), false));
    setProfileDraft(readLS<ProfileDraft>(lsKey(orgId, "profile"), EMPTY_PROFILE));
  }, [orgId]);

  const { counts: c, dismissed: dismissedFromOrg } = useOnboardingProgress();
  const dismissed = dismissedNow || dismissedFromOrg;

  const step1Complete = c.profileSaved || profileSavedLocal;
  const step2Complete = c.memberCount > 1;
  const step3Complete = c.clientCount > 0;
  const step4Complete = c.serviceCodesCount > 0;
  const step5Complete = c.docsCount > 0 || docsSkippedLocal;

  const steps = useMemo(
    () => [
      { n: 1, key: "profile", title: "Tell NECTAR about your agency", done: step1Complete, required: true, href: "/dashboard/nectar-company-profile" as const },
      { n: 2, key: "staff", title: "Add your staff", done: step2Complete, required: true, href: "/dashboard/employees" as const },
      { n: 3, key: "clients", title: "Add your clients", done: step3Complete, required: true, href: "/dashboard/clients" as const },
      { n: 4, key: "services", title: "Configure your service codes", done: step4Complete, required: true, href: "/dashboard/settings/service-codes" as const },
      { n: 5, key: "docs", title: "Company documents (optional)", done: step5Complete, required: false, href: "/dashboard/nectar-docs" as const },
    ],
    [step1Complete, step2Complete, step3Complete, step4Complete, step5Complete],
  );

  const requiredSteps = steps.filter((s) => s.required);
  const completedCount = requiredSteps.filter((s) => s.done).length;
  const allComplete = requiredSteps.every((s) => s.done);

  const defaultActiveStep =
    steps.find((s) => !s.done)?.n ?? 1;
  const activeStep = activeStepOverride ?? defaultActiveStep;

  const shouldShow =
    !!orgId &&
    !dismissed &&
    (welcomeFlag || !allComplete);

  if (!shouldShow || !orgId) return null;

  const dismiss = () => {
    setDismissedNow(true);
    if (!orgId) return;
    void dismissWelcome({ data: { organizationId: orgId } })
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["nectar-onboarding-progress", orgId] }),
      )
      .catch(() => {
        /* banner already hidden */
      });
  };

  const saveProfile = async () => {
    try {
      await (supabase as any)
        .from("organizations")
        .update({
          services_offered: profileDraft.services ?? [],
          approx_client_count: Number(profileDraft.clientCount) || null,
          specializations: profileDraft.specializations?.trim() || null,
          nectar_profile_saved_at: new Date().toISOString(),
        })
        .eq("id", orgId);
    } catch (err) {
      console.warn("[onboarding] nectar profile DB write failed — localStorage fallback active", err);
    }
    writeLS(lsKey(orgId, "profile"), profileDraft);
    writeLS(lsKey(orgId, "profile_saved"), true);
    setProfileSavedLocal(true);
    notifyOnboardingChanged();
    setActiveStepOverride(2);
  };

  const markServicesVisited = () => {
    writeLS(lsKey(orgId, "services_visited"), true);
    setServicesVisited(true);
    notifyOnboardingChanged();
  };

  const skipDocs = () => {
    writeLS(lsKey(orgId, "docs_skipped"), true);
    setDocsSkippedLocal(true);
    notifyOnboardingChanged();
    void queryClient.invalidateQueries({ queryKey: ["nectar-onboarding-progress", orgId] });
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[color:var(--amber-400,var(--hive-gold))]/40 bg-gradient-to-br from-[#0b1733] via-[#0d1a3a] to-[#0b1733] text-amber-50 shadow-xl"
      aria-label="NECTAR onboarding"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 opacity-20">
        <Hexagon className="h-56 w-56 text-[color:var(--amber-400,var(--hive-gold))]" strokeWidth={1} />
      </div>

      <div className="relative flex flex-col gap-4 border-b border-amber-300/15 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
                NECTAR · Onboarding
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-amber-50 sm:text-2xl">
                {allComplete
                  ? `You're set up, ${adminFirstName}.`
                  : `Hi ${adminFirstName}, I'm NECTAR.`}
              </h2>
            </div>
          </div>
          {allComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={dismiss}
              className="shrink-0 text-amber-100 hover:bg-white/10 hover:text-amber-50"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-amber-100/90">
          {allComplete
            ? `I know ${orgName}'s team, clients, and service codes, and I'm ready to help. Ask me anything from the NECTAR panel at any time.`
            : `A few facts about ${orgName} help me guide scheduling, documentation, and billing. Add staff, clients, and service codes when you are ready. Statewide requirements are already in Provider Interface — you do not upload a Scope of Work to finish setup.`}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-amber-200/80">
            <span>Setup progress</span>
            <span>
              {completedCount} of {steps.length} complete
            </span>
          </div>
          <Progress
            value={(completedCount / steps.length) * 100}
            className="h-2 bg-white/10 [&>div]:bg-[color:var(--amber-400,var(--hive-gold))]"
          />
        </div>

        {allComplete && (
          <Button
            onClick={dismiss}
            className="self-start bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]"
          >
            Dismiss & go to dashboard
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      {!allComplete && (
        <div className="relative grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[260px_1fr]">
          <ol className="space-y-1.5">
            {steps.map((s) => {
              const Icon =
                s.key === "profile"
                  ? Building2
                  : s.key === "staff"
                    ? Users
                    : s.key === "clients"
                      ? UserSquare2
                      : s.key === "services"
                        ? SettingsIcon
                        : FolderOpen;
              const isActive = activeStep === s.n;
              const cardClass = cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                s.done
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : isActive
                    ? "border-[color:var(--amber-400,var(--hive-gold))]/60 bg-amber-400/10 text-amber-50"
                    : "border-white/10 bg-white/[0.03] text-amber-100/80 hover:border-amber-300/30 hover:bg-white/[0.05]",
              );
              return (
                <li key={s.key}>
                  <Link
                    to={s.href}
                    search={{ from: "onboarding", step: s.n } as never}
                    onClick={() => setActiveStepOverride(s.n)}
                    className={cardClass}
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        s.done
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-[color:var(--amber-500,var(--hive-gold))]/20 text-[color:var(--amber-400,var(--hive-gold))]",
                      )}
                    >
                      {s.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide opacity-70">
                        Step {s.n}
                        {s.key === "docs" ? " · Optional" : ""}
                      </span>
                      <span className="block text-xs font-medium leading-tight">{s.title}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-amber-50/95 backdrop-blur">
            {activeStep === 1 && (
              <Step1Profile
                draft={profileDraft}
                setDraft={setProfileDraft}
                onSave={saveProfile}
                saved={profileSavedLocal}
              />
            )}
            {activeStep === 2 && (
              <Step2Staff memberCount={c.memberCount} />
            )}
            {activeStep === 3 && (
              <Step3Clients clientCount={c.clientCount} />
            )}
            {activeStep === 4 && (
              <Step4Services
                visited={servicesVisited}
                onVisit={markServicesVisited}
              />
            )}
            {activeStep === 5 && (
              <Step5Docs
                docsCount={c.docsCount}
                skipped={docsSkippedLocal}
                onSkip={skipDocs}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Step1Profile({
  draft,
  setDraft,
  onSave,
  saved,
}: {
  draft: ProfileDraft;
  setDraft: (d: ProfileDraft) => void;
  onSave: () => void;
  saved: boolean;
}) {
  const toggleService = (s: Service) => {
    setDraft({
      ...draft,
      services: draft.services.includes(s)
        ? draft.services.filter((x) => x !== s)
        : [...draft.services, s],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
          Step 1
        </div>
        <h3 className="mt-0.5 font-display text-lg font-semibold text-amber-50">
          Tell me a bit about your operations
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
          A few details so I can calibrate my guidance to your agency.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <Label className="text-xs text-amber-100/90">Services you provide</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((s) => {
              const active = draft.services.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    active
                      ? "border-[color:var(--amber-400,var(--hive-gold))] bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733]"
                      : "border-white/15 bg-white/[0.04] text-amber-100/80 hover:border-amber-300/40",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-amber-100/90">Approx. clients served</Label>
            <Input
              inputMode="numeric"
              value={draft.clientCount}
              onChange={(e) => setDraft({ ...draft, clientCount: e.target.value })}
              className="mt-1 border-white/15 bg-white/5 text-amber-50 placeholder:text-amber-100/40"
              placeholder="e.g. 24"
            />
          </div>
          <div>
            <Label className="text-xs text-amber-100/90">Approx. active staff</Label>
            <Input
              inputMode="numeric"
              value={draft.staffCount}
              onChange={(e) => setDraft({ ...draft, staffCount: e.target.value })}
              className="mt-1 border-white/15 bg-white/5 text-amber-50 placeholder:text-amber-100/40"
              placeholder="e.g. 35"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-amber-100/90">Service area or counties</Label>
          <Input
            value={draft.serviceArea}
            onChange={(e) => setDraft({ ...draft, serviceArea: e.target.value })}
            className="mt-1 border-white/15 bg-white/5 text-amber-50 placeholder:text-amber-100/40"
            placeholder="e.g. Salt Lake, Davis, Weber"
          />
        </div>

        <div>
          <Label className="text-xs text-amber-100/90">Specializations (optional)</Label>
          <Textarea
            rows={2}
            value={draft.specializations}
            onChange={(e) => setDraft({ ...draft, specializations: e.target.value })}
            className="mt-1 border-white/15 bg-white/5 text-amber-50 placeholder:text-amber-100/40"
            placeholder="Behavioral support, medically complex, dual-diagnosis…"
          />
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button
            onClick={onSave}
            className="bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]"
          >
            {saved ? "Update profile" : "Save & continue"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step2Staff({ memberCount }: { memberCount: number }) {
  const invited = 0;
  const inProgress = 0;
  const complete = Math.max(0, memberCount);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
          Step 2
        </div>
        <h3 className="mt-0.5 font-display text-lg font-semibold text-amber-50">
          Add your staff
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
          Add your staff members here. Once they are in the system, I can help
          you schedule them, track their credentials, and make sure they are
          compliant.
        </p>
      </div>

      <div className="rounded-xl bg-white/[0.04] p-1">
        <OnboardingPipelineCard counts={{ invited, inProgress, complete }} />
      </div>

      <Button asChild className="bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]">
        <Link to="/dashboard/employees">
          Go to Employees <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function Step3Clients({ clientCount }: { clientCount: number }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
          Step 3
        </div>
        <h3 className="mt-0.5 font-display text-lg font-semibold text-amber-50">
          Add your clients
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
          Add your clients next. Their profiles, PCSPs, and billing codes are
          what I use to make sure every shift and every medication pass is
          documented correctly.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-amber-100/85">
        <strong className="font-semibold text-amber-50">{clientCount}</strong>{" "}
        client{clientCount === 1 ? "" : "s"} added so far.
      </div>
      <Button asChild className="bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]">
        <Link to="/dashboard/clients">
          Go to Clients <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function Step4Services({
  visited,
  onVisit,
}: {
  visited: boolean;
  onVisit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
          Step 4
        </div>
        <h3 className="mt-0.5 font-display text-lg font-semibold text-amber-50">
          Configure your service codes
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
          Set up the billing codes for the services you provide. This is what
          connects your shifts to Medicaid billing and EVV — I will flag any
          mismatches automatically.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild onClick={onVisit} className="bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]">
          <Link to="/dashboard/settings/service-codes">
            Open service codes <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        {!visited && (
          <Button variant="outline" onClick={onVisit} className="border-amber-300/40 bg-transparent text-amber-50 hover:bg-white/10">
            Mark as configured
          </Button>
        )}
      </div>
    </div>
  );
}

function Step5Docs({
  docsCount,
  skipped,
  onSkip,
}: {
  docsCount: number;
  skipped: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--amber-400,var(--hive-gold))]">
          Step 5 · Optional
        </div>
        <h3 className="mt-0.5 font-display text-lg font-semibold text-amber-50">
          Company documents hub
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-100/85">
          Store agency files here when you have them — contracts, policies,
          certifications, and training records. This is evidence storage, not
          a required setup gate. You can skip it and come back later.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-amber-100/85">
        <strong className="font-semibold text-amber-50">{docsCount}</strong>{" "}
        document{docsCount === 1 ? "" : "s"} on file.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-[color:var(--amber-500,var(--hive-gold))] text-[#0b1733] hover:bg-[color:var(--amber-400,var(--hive-gold))]">
          <Link to="/dashboard/nectar-docs">
            Open Company Documents <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        {!skipped && docsCount === 0 && (
          <Button
            variant="outline"
            onClick={onSkip}
            className="border-amber-300/40 bg-transparent text-amber-50 hover:bg-white/10"
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  );
}

void ChevronDown;
void ChevronUp;
