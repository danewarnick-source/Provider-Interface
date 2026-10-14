import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { requiredSummary, slotChip } from "@/lib/nectar/library/knowledge-view";
import { setRequiredPolicyAnswers } from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { StatusChip } from "./status-chip";
import { useKnowledgeNav, useRefreshKnowledge, useRequiredPolicies } from "./use-knowledge";

type Answers = { providesTransportation?: boolean; managesClientMoney?: boolean };

/** Required policies tab: "X of Y", the two agency answers, one row per slot that applies. */
export function RequiredTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const q = useRequiredPolicies(orgId);
  const setFn = useServerFn(setRequiredPolicyAnswers);
  const refresh = useRefreshKnowledge(orgId);
  const nav = useKnowledgeNav();
  const save = useMutation({
    mutationFn: (answers: Answers) => setFn({ data: { organizationId: orgId, ...answers } }),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save your answer.")),
  });
  if (q.isLoading) return <KnowledgeLoading />;
  if (q.error || !q.data) return <KnowledgeError error={q.error} />;
  const { rows, current, required, toggles } = q.data;
  const answer = (id: string, checked: boolean, label: string, key: keyof Answers) => (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={!canEdit || save.isPending}
        onCheckedChange={(v) => save.mutate({ [key]: v === true })}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card px-4 py-4">
        <p className="text-base font-semibold text-[var(--hive-text)]">
          {requiredSummary(current, required)}
        </p>
        {answer(
          "kb-transport",
          toggles.provides_transportation,
          "We provide transportation",
          "providesTransportation",
        )}
        {answer(
          "kb-finances",
          toggles.manages_client_money,
          "We manage clients' personal money",
          "managesClientMoney",
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows
            .filter((row) => row.applies)
            .map((row) => (
              <li
                key={row.id}
                className="grid min-w-[660px] grid-cols-[120px_minmax(0,2fr)_120px_minmax(0,1.6fr)_96px] items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">{row.codeLabel}</span>
                <span className="font-semibold text-[var(--hive-text)]">{row.label}</span>
                <span>
                  <StatusChip chip={slotChip(row.status)} />
                </span>
                <span className="text-muted-foreground">
                  {row.documentTitle ?? "No document yet"}
                </span>
                <span className="text-right">
                  {row.documentId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav.openDocument(row.documentId!)}
                    >
                      Open
                    </Button>
                  ) : canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nav.newDocument({ slot: row.id })}
                    >
                      Add
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        From DHHS91172 §1.17, §1.18, §1.21 and §1.23. Past review means the review date has passed.
      </p>
    </div>
  );
}
