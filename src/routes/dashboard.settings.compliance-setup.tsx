import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { UnansweredFactsCard } from "@/components/obligations/unanswered-facts-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrg } from "@/hooks/use-org";
import { resolveCatalogExceptions } from "@/lib/obligations/catalog-exceptions";
import {
  ORG_FACT_DEFINITIONS,
  computeObligationApplicability,
  listUnansweredFacts,
  type FactAnswer,
  type OrgFacts,
} from "@/lib/obligations/applicability";
import {
  AWARDED_CODE_CHOICES,
  LIVE_PATH_SETUP_QUESTIONS,
} from "@/lib/obligations/setup-facts";
import { persistAgencySetupFacts } from "@/lib/agency-setup-gate.functions";
import { REQUIRED_SETUP_QUESTIONS } from "@/lib/agency-setup-gate";
import { agencySetupQueryKey, useAgencySetup } from "@/hooks/use-agency-setup";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isAdminLevel } from "@/lib/access/levels";

export const Route = createFileRoute("/dashboard/settings/compliance-setup")({
  head: () => ({ meta: [{ title: "Agency setup — Provider Interface" }] }),
  validateSearch: (s: Record<string, unknown>): { reason?: string } => ({
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: ComplianceSetupPage,
});

const FACT_CHOICES: Array<{ value: FactAnswer; label: string }> = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
  { value: null, label: "Not yet answered" },
];

type SetupDraft = {
  operates_ol_site: FactAnswer;
  uses_volunteers: FactAnswer;
  has_governing_board: FactAnswer;
  servicesOffered: string[];
  approxClientCount: string;
  serviceArea: string;
};

function ComplianceSetupPage() {
  const { user } = useAuth();
  const { data: org } = useCurrentOrg();
  const qc = useQueryClient();
  const search = useSearch({ strict: false }) as { reason?: string };
  const persistFacts = useServerFn(persistAgencySetupFacts);
  const { facts, status, isLoading } = useAgencySetup();
  const orgId = org?.organization_id ?? null;
  const canEdit =
    isAdminLevel(org?.access.level);

  const [draft, setDraft] = useState<SetupDraft>({
    operates_ol_site: null,
    uses_volunteers: null,
    has_governing_board: null,
    servicesOffered: [],
    approxClientCount: "",
    serviceArea: "",
  });

  useEffect(() => {
    setDraft({
      operates_ol_site: facts.operates_ol_site,
      uses_volunteers: facts.uses_volunteers,
      has_governing_board: facts.has_governing_board,
      servicesOffered: facts.servicesOffered,
      approxClientCount: facts.approxClientCount == null ? "" : String(facts.approxClientCount),
      serviceArea: facts.serviceArea ?? "",
    });
  }, [facts]);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId || !user?.id) throw new Error("No organization selected.");
      const count = draft.approxClientCount.trim() === "" ? null : Number(draft.approxClientCount);
      return persistFacts({
        data: {
          organizationId: orgId,
          operates_ol_site: draft.operates_ol_site,
          uses_volunteers: draft.uses_volunteers,
          has_governing_board: draft.has_governing_board,
          servicesOffered: draft.servicesOffered,
          approxClientCount: Number.isFinite(count as number) ? (count as number) : null,
          serviceArea: draft.serviceArea.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Agency setup saved");
      await qc.invalidateQueries({ queryKey: agencySetupQueryKey(orgId) });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not save agency setup");
    },
  });

  if (!org) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">Select an organization to continue.</p>
      </div>
    );
  }

  const merged: OrgFacts = {
    ...facts,
    operates_ol_site: draft.operates_ol_site,
    uses_volunteers: draft.uses_volunteers,
    has_governing_board: draft.has_governing_board,
    servicesOffered: draft.servicesOffered ?? [],
  };
  const unanswered = listUnansweredFacts(merged);
  const preview = computeObligationApplicability(merged);
  const visible = preview.filter((row) => row.applies);
  const hidden = preview.filter((row) => !row.applies);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/dashboard/settings"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Settings
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ClipboardList className="h-5 w-5" /> Agency setup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record awarded service codes and operational facts. Questions are concrete — never whether
          a SOW article applies. Staff and client creation stay closed until all required facts are
          saved ({status.progressLabel}).
        </p>
      </div>

      {search.reason === "setup_incomplete" ? (
        <div
          data-testid="setup-redirect-reason"
          className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Staff and client screens stay closed until required operating questions are answered.
          Skip is disabled at {status.progressLabel}.
        </div>
      ) : null}

      <UnansweredFactsCard unanswered={unanswered} showSetupLink={false} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading setup facts…</p>
      ) : (
        <form
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canEdit) return;
            save.mutate();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Which DSPD service codes is this contractor awarded?
            </legend>
            <p className="text-xs text-muted-foreground">
              Same codes as the company profile. Leave empty until known — empty is unanswered, not
              N/A. Extra codes already stored stay listed.
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                new Set([
                  ...AWARDED_CODE_CHOICES,
                  ...(draft.servicesOffered ?? []).map((c) => c.toUpperCase()),
                ]),
              ).map((code) => {
                const selected = (draft.servicesOffered ?? []).includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={selected}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                    onClick={() =>
                      setDraft((prev) => {
                        const current = prev.servicesOffered ?? [];
                        return {
                          ...prev,
                          servicesOffered: selected
                            ? current.filter((c) => c !== code)
                            : [...current, code],
                        };
                      })
                    }
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">{REQUIRED_SETUP_QUESTIONS[4]?.question}</label>
              <Input
                inputMode="numeric"
                disabled={!canEdit}
                value={draft.approxClientCount}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, approxClientCount: e.target.value }))
                }
                placeholder="e.g. 24"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{REQUIRED_SETUP_QUESTIONS[5]?.question}</label>
              <Input
                disabled={!canEdit}
                value={draft.serviceArea}
                onChange={(e) => setDraft((prev) => ({ ...prev, serviceArea: e.target.value }))}
                placeholder="e.g. Salt Lake, Davis"
              />
            </div>
          </div>

          {ORG_FACT_DEFINITIONS.map((def) => (
            <fieldset key={def.key} className="space-y-2">
              <legend className="text-sm font-medium">{def.question}</legend>
              <p className="text-xs text-muted-foreground">{def.help}</p>
              <div className="flex flex-wrap gap-2">
                {FACT_CHOICES.map((choice) => {
                  const selected = draft[def.key] === choice.value;
                  return (
                    <button
                      key={String(choice.value)}
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={selected}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          [def.key]: choice.value,
                        }))
                      }
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {canEdit ? (
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save setup facts"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners, program managers, and supervisors can change these facts.
            </p>
          )}
        </form>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">What this means for the register</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Awarded codes{" "}
          {merged.servicesOffered.length
            ? merged.servicesOffered.join(", ")
            : "are unanswered"}.
          Empty codes keep code-gated rows visible until recorded.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stay visible
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {visible.map((row) => (
                <li key={row.obligationKey}>
                  {row.title}
                  {row.unanswered ? " (until answered)" : ""}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Do not apply
            </h3>
            {hidden.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {hidden.map((row) => (
                  <li key={row.obligationKey}>{row.title}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">Live paths on the current catalog</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Each path uses a concrete fact the engine already reads. Exceptions are on the catalog
          record. SOW CSV import is still deferred.
        </p>
        <ul className="mt-4 space-y-3">
          {LIVE_PATH_SETUP_QUESTIONS.map((path) => {
            const flags = path.dutyKeys.map((key) => ({
              key,
              ...resolveCatalogExceptions(key),
            }));
            const labels = [
              flags.some((f) => f.nonwaivable) ? "Nonwaivable" : null,
              flags.some((f) => f.sei_only) ? "SEI-only" : null,
              flags.some((f) => f.assignment_gated) ? "Assignment-gated" : null,
            ].filter(Boolean);
            return (
              <li key={path.path} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-sm font-medium">{path.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">{path.help}</p>
                {labels.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{labels.join(" · ")}</p>
                ) : null}
                {path.ownerAnswers ? (
                  <p className="mt-1 text-xs text-muted-foreground">Recorded on this page.</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Read from live assignments, person records, or 1056 authorizations.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
