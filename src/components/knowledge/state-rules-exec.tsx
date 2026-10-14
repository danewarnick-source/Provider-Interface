import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/nectar/library/knowledge-view";
import { listStateRules, refreshStateRuleSearch } from "@/lib/nectar/library/state-rules.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { StateRuleUploadForm } from "./state-rule-upload-form";

const QUERY_KEY = ["exec-state-rules"] as const;
/** "Update search" asks again while sections still need an embedding and each call makes progress. */
const MAX_SEARCH_ROUNDS = 25;

type Rule = Awaited<ReturnType<typeof listStateRules>>[number];
type Form = { ruleKey: string; title: string; effectiveFrom: string | null } | null;

/** Puts a version in Nectar search, a batch of embeddings per call, until done or stuck. */
function useFillSearch() {
  const fn = useServerFn(refreshStateRuleSearch);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (stateRuleId: string) => {
    setBusy(stateRuleId);
    try {
      let last = await fn({ data: { stateRuleId } });
      for (let round = 0; round < MAX_SEARCH_ROUNDS && last.pending > 0; round++) {
        const next = await fn({ data: { stateRuleId } });
        if (next.embedded <= last.embedded) break;
        last = next;
      }
      toast.success(last.label);
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not update Nectar search."));
    } finally {
      setBusy(null);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    }
  };
  return { run, busy };
}

/**
 * The State rules section of /dashboard/hive-exec/knowledge (N4, Decision 6):
 * PI loads state rules once for every agency. Agencies read them in their
 * Knowledge base; Nectar answers from them.
 */
export function StateRulesSection() {
  const listFn = useServerFn(listStateRules);
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => listFn() });
  const [form, setForm] = useState<Form | "new">(null);
  const fill = useFillSearch();

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-[var(--hive-text)]">
            State rules
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Loaded by PI for every agency. Agencies read them in their Knowledge base and Nectar
            answers from them. A new version replaces the current one; the old one is kept.
          </p>
        </div>
        <Button size="sm" onClick={() => setForm("new")} disabled={form !== null}>
          Add a state rule
        </Button>
      </header>
      {form !== null ? (
        <StateRuleUploadForm
          rule={form === "new" ? null : form}
          onCancel={() => setForm(null)}
          onPublished={(published) => {
            setForm(null);
            toast.success(`Version ${published.version} published.`);
            void fill.run(published.id);
          }}
        />
      ) : null}
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {q.error ? (
        <p role="alert" className="text-sm text-[var(--hive-danger-fg)]">
          {safeErrorMessage(q.error, "Could not load the state rules.")}
        </p>
      ) : null}
      {q.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No state rules yet.</p>
      ) : null}
      <ul className="divide-y divide-border">
        {(q.data ?? []).map((rule) => (
          <StateRuleItem
            key={rule.id}
            rule={rule}
            busy={fill.busy === rule.id}
            onReplace={() =>
              setForm({
                ruleKey: rule.rule_key,
                title: rule.title,
                effectiveFrom: rule.effective_from,
              })
            }
            onFill={() => void fill.run(rule.id)}
            locked={form !== null || fill.busy !== null}
          />
        ))}
      </ul>
    </section>
  );
}

function StateRuleItem({
  rule,
  busy,
  locked,
  onReplace,
  onFill,
}: {
  rule: Rule;
  busy: boolean;
  locked: boolean;
  onReplace: () => void;
  onFill: () => void;
}) {
  const details = [`v${rule.version}`];
  if (rule.effective_from) details.push(`effective ${formatDay(rule.effective_from)}`);
  if (rule.versions.length > 1) details.push(`${rule.versions.length - 1} older version(s) kept`);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium text-[var(--hive-text)]">{rule.title}</p>
        <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
        <p className="text-xs text-muted-foreground">{rule.search.label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onFill} disabled={locked}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {busy ? "Updating search…" : "Update search"}
        </Button>
        <Button size="sm" variant="outline" onClick={onReplace} disabled={locked}>
          Upload new version
        </Button>
      </div>
    </li>
  );
}
