import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-org";
import { buildCatalogCoverageReport } from "@/lib/obligations/catalog-coverage";
import { loadCommittedCatalog } from "@/lib/obligations/draft-rules/catalog-committed";
import {
  CORE_RULE_LOGIC_SLICE,
  FIRST_EXECUTABLE_BATCH_RULE_IDS,
  SECOND_BATCH_DEMO_PATH,
  SECOND_EXECUTABLE_BATCH_RULE_IDS,
  THIRD_BATCH_DEMO_PATH,
  THIRD_EXECUTABLE_BATCH_FIXTURE_IDS,
  THIRD_EXECUTABLE_BATCH_RULE_IDS,
  FOURTH_BATCH_DEMO_PATH,
  FOURTH_EXECUTABLE_BATCH_FIXTURE_IDS,
  FOURTH_EXECUTABLE_BATCH_RULE_IDS,
  WORKBOOK_DESIGN_REVISION,
  WORKBOOK_SOURCE_TITLE,
  draftRuleAdminRow,
  firstExecutableBatchParents,
  secondExecutableBatchParents,
  thirdExecutableBatchParents,
  fourthExecutableBatchParents,
} from "@/lib/obligations/draft-rules";

const WIRED_BATCH_IDS = new Set<string>([
  ...FIRST_EXECUTABLE_BATCH_RULE_IDS,
  ...SECOND_EXECUTABLE_BATCH_RULE_IDS,
  ...THIRD_EXECUTABLE_BATCH_RULE_IDS,
  ...THIRD_EXECUTABLE_BATCH_FIXTURE_IDS,
  ...FOURTH_EXECUTABLE_BATCH_RULE_IDS,
  ...FOURTH_EXECUTABLE_BATCH_FIXTURE_IDS,
]);

export const Route = createFileRoute("/dashboard/settings/draft-rules")({
  head: () => ({ meta: [{ title: "Draft rules (simulation) — Provider Interface" }] }),
  component: DraftRulesSimulationPage,
});

function DraftRulesSimulationPage() {
  const { data: org } = useCurrentOrg();

  const firstBatchQuery = useQuery({
    queryKey: ["draft-rules-first-batch", WORKBOOK_DESIGN_REVISION],
    queryFn: async () => {
      const loaded = loadCommittedCatalog();
      return firstExecutableBatchParents(loaded.parents).map((rule) => ({
        ...draftRuleAdminRow(rule),
        liveKey: rule.catalogKeys[0] ?? null,
      }));
    },
  });

  const secondBatchQuery = useQuery({
    queryKey: ["draft-rules-second-batch", WORKBOOK_DESIGN_REVISION],
    queryFn: async () => {
      const loaded = loadCommittedCatalog();
      return secondExecutableBatchParents(loaded.parents).map((rule) => ({
        ...draftRuleAdminRow(rule),
        liveKey: rule.catalogKeys[0] ?? null,
      }));
    },
  });

  const thirdBatchQuery = useQuery({
    queryKey: ["draft-rules-third-batch", WORKBOOK_DESIGN_REVISION],
    queryFn: async () => {
      const loaded = loadCommittedCatalog();
      return thirdExecutableBatchParents(loaded.parents).map((rule) => ({
        ...draftRuleAdminRow(rule),
        liveKey: rule.catalogKeys[0] ?? null,
      }));
    },
  });

  const fourthBatchQuery = useQuery({
    queryKey: ["draft-rules-fourth-batch", WORKBOOK_DESIGN_REVISION],
    queryFn: async () => {
      const loaded = loadCommittedCatalog();
      return fourthExecutableBatchParents(loaded.parents).map((rule) => ({
        ...draftRuleAdminRow(rule),
        liveKey: rule.catalogKeys[0] ?? null,
      }));
    },
  });

  const rowsQuery = useQuery({
    queryKey: ["draft-rules-simulation", WORKBOOK_DESIGN_REVISION],
    queryFn: async () =>
      CORE_RULE_LOGIC_SLICE.filter((rule) => !WIRED_BATCH_IDS.has(rule.id)).map(draftRuleAdminRow),
  });

  const catalogQuery = useQuery({
    queryKey: ["draft-rules-catalog-coverage", WORKBOOK_DESIGN_REVISION],
    queryFn: async () => {
      const loaded = loadCommittedCatalog();
      const report = buildCatalogCoverageReport(loaded);
      return {
        workbookSha256: report.workbookSha256,
        ingestStatus: loaded.ingestStatus,
        counts: report.counts,
        sourceIndex: "ARCHIVE METADATA" as const,
      };
    },
  });

  if (!org) {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">Select an organization to continue.</p>
      </div>
    );
  }

  const firstBatch = firstBatchQuery.data ?? [];
  const secondBatch = secondBatchQuery.data ?? [];
  const thirdBatch = thirdBatchQuery.data ?? [];
  const fourthBatch = fourthBatchQuery.data ?? [];
  const rows = rowsQuery.data ?? [];
  const counts = catalogQuery.data?.counts;

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
          <FlaskConical className="h-5 w-5" /> Draft rules (simulation)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {WORKBOOK_SOURCE_TITLE} design revision {WORKBOOK_DESIGN_REVISION}. Imported catalog
          parents reuse the live obligation engine (assignments, evidence, training, forms,
          reminders, admin review). Child elements stay on the parent and do not mint a second staff
          task. Publication is per verified rule — unrelated Release_Gaps do not lock the catalog.
          Source_index is archive metadata, not permission.
        </p>
      </div>

      {catalogQuery.data && counts ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-card)]">
          <p className="font-semibold">Finalized catalog coverage</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Workbook sha256 {catalogQuery.data.workbookSha256}</li>
            <li>
              Imported {counts.importedParents} parents / {counts.importedElements} elements (
              {catalogQuery.data.ingestStatus})
            </li>
            <li>
              Executable (live key) {counts.executable} · wired {counts.wired} (first{" "}
              {counts.wiredFirstBatch} · second {counts.wiredSecondBatch} · third{" "}
              {counts.wiredThirdBatch} · fourth {counts.wiredFourthBatch}) · verified{" "}
              {counts.verified} · published {counts.published} · blocked {counts.blocked} · unwired{" "}
              {counts.draftUnwired}
            </li>
            <li>
              Source_index={catalogQuery.data.sourceIndex} · canActivateAny=
              {counts.published > 0 ? "mixed" : "false"}
            </li>
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">Demo path — assignment clocks</h2>
        <p className="mt-1 text-muted-foreground">
          Reese walk: facts, then one parent{" "}
          <Link to="/dashboard/my-obligations" className="underline underline-offset-2">
            My tasks
          </Link>{" "}
          card, then evidence, then admin review on{" "}
          <Link to="/dashboard/company-obligations" className="underline underline-offset-2">
            Company obligations
          </Link>
          , then the live due rule. Child items stay on the parent. ACRE SEI (30.6.b / 30.6.c) is
          one card.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          {SECOND_BATCH_DEMO_PATH.map((step) => (
            <li key={step.step}>
              <span className="font-medium text-foreground">{step.title}.</span> {step.detail}
            </li>
          ))}
        </ol>
      </div>

      {firstBatchQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading first executable batch…</p>
      ) : firstBatch.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">First executable batch — hire training clocks</h2>
          <p className="text-sm text-muted-foreground">
            Orientation, CPR / First Aid, person-centered thinking, behavior certification, annual
            12-hour CE, and ABI reuse the live obligation engine. One parent assignment. Child
            elements stay on the parent. Missing assignment facts stay questions. Not published.
          </p>
          <ul className="space-y-4">
            {firstBatch.map((row) => {
              const ready = row.canPublish && !row.canActivate;
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.id}
                        {row.liveKey ? ` · live ${row.liveKey}` : ""} · {row.clauseIds.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">status={row.lifecycle}</Badge>
                      <Badge variant="outline">{row.publication}</Badge>
                      {row.canActivate ? (
                        <Badge>activatable</Badge>
                      ) : ready ? (
                        <Badge variant="outline">wired — ready for per-rule publish</Badge>
                      ) : (
                        <Badge variant="outline">draft</Badge>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {row.gaps.length === 0 ? (
                      <li>
                        Wired to the live engine. Unrelated workbook Release_Gaps do not block this
                        rule. Record an explicit approval to publish this rule only.
                      </li>
                    ) : (
                      row.gaps.map((gap) => <li key={gap.key}>{gap.reason}</li>)
                    )}
                  </ul>
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled
                    title={
                      row.canActivate
                        ? "This rule is individually verified."
                        : ready
                          ? "Record approval in the verified-publication overlay. This screen does not flip tenants."
                          : row.gaps.map((g) => g.reason).join(" ")
                    }
                  >
                    {row.canActivate ? "Published (this rule)" : "Publish this rule"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {thirdBatchQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading third executable batch…</p>
      ) : thirdBatch.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Third executable batch — USOR and SJD clocks</h2>
          <p className="text-sm text-muted-foreground">
            USOR approved-vendor proof (SEI cohort branches), SJD ACRE within 60 days with
            supervision pending, and Customized Employment only if Discovery reuse the live
            obligation engine. One parent assignment. Child elements stay on the parent. Missing
            award, assignment, or Discovery facts stay questions. Not published. Published USOR
            email spelling and the SJB typo stay Release_Gaps — this screen does not invent a fix.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {THIRD_BATCH_DEMO_PATH.map((step) => (
              <li key={step.step}>
                <span className="font-medium text-foreground">{step.title}.</span> {step.detail}
              </li>
            ))}
          </ol>
          <ul className="space-y-4">
            {thirdBatch.map((row) => {
              const ready = row.canPublish && !row.canActivate;
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.id}
                        {row.liveKey ? ` · live ${row.liveKey}` : ""} · {row.clauseIds.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">status={row.lifecycle}</Badge>
                      <Badge variant="outline">{row.publication}</Badge>
                      {row.canActivate ? (
                        <Badge>activatable</Badge>
                      ) : ready ? (
                        <Badge variant="outline">wired — ready for per-rule publish</Badge>
                      ) : (
                        <Badge variant="outline">draft</Badge>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {row.gaps.length === 0 ? (
                      <li>
                        Wired to the live engine. Unrelated workbook Release_Gaps do not block this
                        rule. Record an explicit approval to publish this rule only.
                      </li>
                    ) : (
                      row.gaps.map((gap) => <li key={gap.key}>{gap.reason}</li>)
                    )}
                  </ul>
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled
                    title={
                      row.canActivate
                        ? "This rule is individually verified."
                        : ready
                          ? "Record approval in the verified-publication overlay. This screen does not flip tenants."
                          : row.gaps.map((g) => g.reason).join(" ")
                    }
                  >
                    {row.canActivate ? "Published (this rule)" : "Publish this rule"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {fourthBatchQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading fourth executable batch…</p>
      ) : fourthBatch.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            Fourth executable batch — periodic monthly summaries
          </h2>
          <p className="text-sm text-muted-foreground">
            §1.25 monthly substitutes reuse the live obligation engine: SEI and SJD monthly UPI
            attestation, and CMP/CMS monthly summaries to the Support Coordinator. One parent
            assignment. One report per code — never monthly plus quarterly on the same code. SLN
            stays quarterly. Child elements stay on the parent. Missing awarded-code or caseload
            facts stay questions. Not published. HIVE does not transmit to UPI or email the Support
            Coordinator.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {FOURTH_BATCH_DEMO_PATH.map((step) => (
              <li key={step.step}>
                <span className="font-medium text-foreground">{step.title}.</span> {step.detail}
              </li>
            ))}
          </ol>
          <ul className="space-y-4">
            {fourthBatch.map((row) => {
              const ready = row.canPublish && !row.canActivate;
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.id}
                        {row.liveKey ? ` · live ${row.liveKey}` : ""} · {row.clauseIds.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">status={row.lifecycle}</Badge>
                      <Badge variant="outline">{row.publication}</Badge>
                      {row.canActivate ? (
                        <Badge>activatable</Badge>
                      ) : ready ? (
                        <Badge variant="outline">wired — ready for per-rule publish</Badge>
                      ) : (
                        <Badge variant="outline">draft</Badge>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {row.gaps.length === 0 ? (
                      <li>
                        Wired to the live engine. Unrelated workbook Release_Gaps do not block this
                        rule. Record an explicit approval to publish this rule only.
                      </li>
                    ) : (
                      row.gaps.map((gap) => <li key={gap.key}>{gap.reason}</li>)
                    )}
                  </ul>
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled
                    title={
                      row.canActivate
                        ? "This rule is individually verified."
                        : ready
                          ? "Record approval in the verified-publication overlay. This screen does not flip tenants."
                          : row.gaps.map((g) => g.reason).join(" ")
                    }
                  >
                    {row.canActivate ? "Published (this rule)" : "Publish this rule"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {secondBatchQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading second executable batch…</p>
      ) : secondBatch.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            Second executable batch — service assignment clocks
          </h2>
          <p className="text-sm text-muted-foreground">
            Driving record, ACRE SEI/SED, SEI benefits designation, and CMP/CMS caregiver
            compensation reuse the live obligation engine. One parent assignment. REQ-30.6.b and
            REQ-30.6.c share the ACRE SEI card. Missing assignment facts stay questions. Not
            published.
          </p>
          <ul className="space-y-4">
            {secondBatch.map((row) => {
              const ready = row.canPublish && !row.canActivate;
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.id}
                        {row.liveKey ? ` · live ${row.liveKey}` : ""} · {row.clauseIds.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">status={row.lifecycle}</Badge>
                      <Badge variant="outline">{row.publication}</Badge>
                      {row.canActivate ? (
                        <Badge>activatable</Badge>
                      ) : ready ? (
                        <Badge variant="outline">wired — ready for per-rule publish</Badge>
                      ) : (
                        <Badge variant="outline">draft</Badge>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {row.gaps.length === 0 ? (
                      <li>
                        Wired to the live engine. Unrelated workbook Release_Gaps do not block this
                        rule. Record an explicit approval to publish this rule only.
                      </li>
                    ) : (
                      row.gaps.map((gap) => <li key={gap.key}>{gap.reason}</li>)
                    )}
                  </ul>
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled
                    title={
                      row.canActivate
                        ? "This rule is individually verified."
                        : ready
                          ? "Record approval in the verified-publication overlay. This screen does not flip tenants."
                          : row.gaps.map((g) => g.reason).join(" ")
                    }
                  >
                    {row.canActivate ? "Published (this rule)" : "Publish this rule"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {rowsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading remaining draft rules…</p>
      ) : (
        <ul className="space-y-4">
          {rows.length > 0 ? (
            <li className="list-none">
              <h2 className="text-sm font-semibold">Remaining Core_Rule_Logic fixtures</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Later shared-behavior batches. Still draft. Not this PR.
              </p>
            </li>
          ) : null}
          {rows.map((row) => {
            const ready = row.canPublish && !row.canActivate;
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.id} · {row.clauseIds.join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">status={row.lifecycle}</Badge>
                    <Badge variant="outline">{row.publication}</Badge>
                    {row.canActivate ? (
                      <Badge>activatable</Badge>
                    ) : ready ? (
                      <Badge variant="outline">ready for per-rule publish</Badge>
                    ) : (
                      <Badge variant="outline">draft</Badge>
                    )}
                  </div>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {row.gaps.length === 0 ? (
                    <li>
                      Structurally complete. Unrelated workbook Release_Gaps do not block this rule.
                      Record an explicit approval to publish this rule only.
                    </li>
                  ) : (
                    row.gaps.map((gap) => <li key={gap.key}>{gap.reason}</li>)
                  )}
                </ul>
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled
                  title={
                    row.canActivate
                      ? "This rule is individually verified."
                      : ready
                        ? "Record approval in the verified-publication overlay. This screen does not flip tenants."
                        : row.gaps.map((g) => g.reason).join(" ")
                  }
                >
                  {row.canActivate ? "Published (this rule)" : "Publish this rule"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
