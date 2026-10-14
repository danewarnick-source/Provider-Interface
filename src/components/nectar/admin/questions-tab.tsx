// Admin Nectar's Questions tab (N6, Decision 9, as in the demo): questions
// Nectar couldn't answer and answers someone marked not helpful, with who
// asked and when. Two actions: Add to library (New document in the Knowledge
// base, prefilled from the question; saving it resolves the question) and
// Mark resolved / Reopen.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { StatusChip } from "@/components/knowledge/status-chip";
import { Button } from "@/components/ui/button";
import {
  QUESTION_FILTERS,
  type QuestionCard,
  type QuestionFilter,
} from "@/lib/nectar/engine/questions-admin";
import { cn } from "@/lib/utils";
import { AdminError, AdminLoading } from "./admin-states";
import { useNectarQuestions, useSetQuestionStatus } from "./use-nectar-admin";

const FILTER_LABEL: Record<QuestionFilter, string> = {
  open: "Open",
  resolved: "Resolved",
  all: "All",
};

export function QuestionsTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const [filter, setFilter] = useState<QuestionFilter>("open");
  const q = useNectarQuestions(orgId, filter);
  const status = useSetQuestionStatus(orgId);
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Questions Nectar couldn't answer, and answers someone marked not helpful. Each one usually
        means a policy is missing or unclear.
      </p>
      <div role="group" aria-label="Show questions" className="flex flex-wrap gap-1.5">
        {QUESTION_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-[36px] rounded-full border px-3.5 text-sm font-semibold transition-colors",
              filter === f
                ? "border-[var(--hive-text)] bg-[var(--hive-text)] text-white"
                : "border-border bg-card text-[var(--hive-text)] hover:bg-muted",
            )}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <AdminLoading />
      ) : q.error || !q.data ? (
        <AdminError error={q.error} />
      ) : q.data.questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <ul className="space-y-3">
          {q.data.questions.map((card) => (
            <li key={card.id}>
              <QuestionItem
                card={card}
                canEdit={canEdit}
                busy={status.isPending && status.variables?.questionId === card.id}
                onToggle={() =>
                  status.mutate({
                    questionId: card.id,
                    status: card.status === "open" ? "resolved" : "open",
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionItem({
  card,
  canEdit,
  busy,
  onToggle,
}: {
  card: QuestionCard;
  canEdit: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          chip={{
            label: card.kindLabel,
            tone: card.kind === "not_found" ? "missing" : "past_review",
          }}
        />
        <span className="text-sm text-muted-foreground">
          {card.asker} · {card.when}
        </span>
        {card.status === "resolved" ? (
          <span className="text-xs font-bold text-[var(--hive-ok-fg)]">Resolved</span>
        ) : null}
      </div>
      <p className="text-base font-semibold text-[var(--hive-text)]">"{card.question}"</p>
      {card.answer ? (
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          <span className="font-semibold text-[var(--hive-text)]">Nectar answered:</span>{" "}
          {card.answer}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" asChild>
            <Link to="/dashboard/hub/knowledge" search={{ new: true, question: card.id }}>
              Add to library
            </Link>
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onToggle}>
            {card.status === "open" ? "Mark resolved" : "Reopen"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
