import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ClipboardList, X } from "lucide-react";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { dismissAdminWelcome } from "@/lib/admin-home-welcome.functions";
import { persistAgencySetupFacts } from "@/lib/agency-setup-gate.functions";
import {
  AGENCY_SETUP_PATH,
  REQUIRED_SETUP_QUESTIONS,
  canSkipAgencySetup,
  type AgencySetupFacts,
} from "@/lib/agency-setup-gate";
import { AWARDED_CODE_CHOICES } from "@/lib/obligations/setup-facts";
import { agencySetupQueryKey, useAgencySetup } from "@/hooks/use-agency-setup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type FactAnswer = boolean | null;

type Draft = {
  services: string[];
  operates_ol_site: FactAnswer;
  uses_volunteers: FactAnswer;
  has_governing_board: FactAnswer;
  clientCount: string;
  serviceArea: string;
};

const EMPTY_DRAFT: Draft = {
  services: [],
  operates_ol_site: null,
  uses_volunteers: null,
  has_governing_board: null,
  clientCount: "",
  serviceArea: "",
};

const FACT_CHOICES: Array<{ value: FactAnswer; label: string }> = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
];

function factsToDraft(facts: AgencySetupFacts): Draft {
  return {
    services: facts.servicesOffered,
    operates_ol_site: facts.operates_ol_site,
    uses_volunteers: facts.uses_volunteers,
    has_governing_board: facts.has_governing_board,
    clientCount: facts.approxClientCount == null ? "" : String(facts.approxClientCount),
    serviceArea: facts.serviceArea ?? "",
  };
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
  const persistFacts = useServerFn(persistAgencySetupFacts);
  const orgId = org?.organization_id;
  const orgName = org?.organization_name ?? "your agency";
  const { status, facts, isLoading } = useAgencySetup();

  const [dismissedNow, setDismissedNow] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!orgId || isLoading || hydrated) return;
    setDraft(factsToDraft(facts));
    setHydrated(true);
  }, [orgId, isLoading, hydrated, facts]);

  const canSkip = canSkipAgencySetup(status);
  const shouldShow = !!orgId && !dismissedNow && (welcomeFlag || !status.complete);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId || !user?.id) throw new Error("No organization selected.");
      const count = draft.clientCount.trim() === "" ? null : Number(draft.clientCount);
      return persistFacts({
        data: {
          organizationId: orgId,
          operates_ol_site: draft.operates_ol_site,
          uses_volunteers: draft.uses_volunteers,
          has_governing_board: draft.has_governing_board,
          servicesOffered: draft.services,
          approxClientCount: Number.isFinite(count as number) ? (count as number) : null,
          serviceArea: draft.serviceArea.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Operating facts saved");
      await queryClient.invalidateQueries({ queryKey: agencySetupQueryKey(orgId) });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not save setup facts");
    },
  });

  if (!shouldShow || !orgId) return null;

  const dismiss = () => {
    if (!canSkip) return;
    setDismissedNow(true);
    void dismissWelcome({ data: { organizationId: orgId } })
      .then(() => queryClient.invalidateQueries({ queryKey: agencySetupQueryKey(orgId) }))
      .catch(() => {
        /* already hidden */
      });
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[var(--hive-border)] bg-[var(--hive-surface)] text-[var(--hive-text)] shadow-[var(--shadow-card)]"
      aria-label="Agency setup"
      data-testid="agency-setup-panel"
    >
      <div className="relative flex flex-col gap-4 border-b border-[var(--hive-border)] px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hive-sidebar)] text-[var(--hive-gold)]">
              <PiMark className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--hive-text-muted)]">
                NECTAR · Agency setup
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)] sm:text-2xl">
                {status.complete ? "Operating facts are on file." : `Tell me about ${orgName}.`}
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            disabled={!canSkip}
            data-testid="agency-setup-skip"
            className="shrink-0 disabled:opacity-40"
          >
            {status.complete ? <X className="h-4 w-4" /> : "Skip"}
          </Button>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed text-[var(--hive-text-muted)]">
          {status.complete
            ? "Staff and client records can be added now. Statewide requirements stay in Provider Interface — you do not upload a Scope of Work to finish setup."
            : "Answer the required operating questions before adding staff or clients. Skip stays off until every required fact is saved. Statewide requirements are already in Provider Interface — you do not upload a Scope of Work to finish setup."}
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[var(--hive-text-muted)]">
            <span>Setup progress</span>
            <span data-testid="agency-setup-progress">{status.progressLabel} complete</span>
          </div>
          <Progress
            value={(status.answeredCount / status.requiredCount) * 100}
            className="h-2 bg-[var(--hive-muted-surface)] [&>div]:bg-[var(--hive-gold)]"
          />
        </div>

        {!canSkip ? (
          <p className="text-xs text-[var(--hive-text-muted)]">
            Skip is disabled until all required operating questions are answered.
          </p>
        ) : (
          <Button
            onClick={dismiss}
            className="self-start"
          >
            Dismiss and go to dashboard
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      {!status.complete && (
        <form
          className="relative space-y-4 px-5 py-5 sm:px-7"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {REQUIRED_SETUP_QUESTIONS[0]?.question}
            </legend>
            <div className="flex flex-wrap gap-2">
              {AWARDED_CODE_CHOICES.map((code) => {
                const selected = draft.services.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        services: selected
                          ? prev.services.filter((c) => c !== code)
                          : [...prev.services, code],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      selected
                        ? "border-[var(--hive-gold)] bg-[var(--hive-primary)] text-[var(--hive-primary-fg)]"
                        : "border-[var(--hive-border)] bg-[var(--hive-canvas)] text-[var(--hive-text-muted)] hover:bg-[var(--hive-muted-surface)]",
                    )}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {(
            [
              ["operates_ol_site", REQUIRED_SETUP_QUESTIONS[1]],
              ["uses_volunteers", REQUIRED_SETUP_QUESTIONS[2]],
              ["has_governing_board", REQUIRED_SETUP_QUESTIONS[3]],
            ] as const
          ).map(([key, q]) => (
            <fieldset key={key} className="space-y-2">
              <legend className="text-sm font-medium">{q?.question}</legend>
              <div className="flex flex-wrap gap-2">
                {FACT_CHOICES.map((choice) => {
                  const selected = draft[key] === choice.value;
                  return (
                    <button
                      key={String(choice.value)}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft((prev) => ({ ...prev, [key]: choice.value }))}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm",
                        selected
                          ? "border-[var(--hive-gold)] bg-[var(--hive-gold-soft)] text-[var(--hive-text)]"
                          : "border-[var(--hive-border)] bg-[var(--hive-canvas)] text-[var(--hive-text-muted)] hover:bg-[var(--hive-muted-surface)]",
                      )}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-[var(--hive-text-muted)]">
                {REQUIRED_SETUP_QUESTIONS[4]?.question}
              </Label>
              <Input
                inputMode="numeric"
                value={draft.clientCount}
                onChange={(e) => setDraft((prev) => ({ ...prev, clientCount: e.target.value }))}
                className="mt-1"
                placeholder="e.g. 24"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--hive-text-muted)]">
                {REQUIRED_SETUP_QUESTIONS[5]?.question}
              </Label>
              <Input
                value={draft.serviceArea}
                onChange={(e) => setDraft((prev) => ({ ...prev, serviceArea: e.target.value }))}
                className="mt-1"
                placeholder="e.g. Salt Lake, Davis"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save operating facts"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to={AGENCY_SETUP_PATH}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Open full setup
              </Link>
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
