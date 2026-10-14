// Parts of the approve-and-publish dialog: the supports still lacking a
// strategy (with the reason to approve anyway) and the staff questions.

import { Textarea } from "@/components/ui/textarea";

export function GapsReason({
  gaps,
  reason,
  onReason,
}: {
  gaps: string[];
  reason: string;
  onReason: (v: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-hive-gold/50 bg-hive-gold-soft p-3 text-sm text-hive-ink">
      <p className="font-medium">
        {gaps.length} support{gaps.length === 1 ? " has" : "s have"} no strategy yet:
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        {gaps.map((g, i) => (
          <li key={i}>{g}</li>
        ))}
      </ul>
      <label className="block text-xs font-medium" htmlFor="approve-gap-reason">
        Why approve without them?
      </label>
      <Textarea
        id="approve-gap-reason"
        rows={2}
        value={reason}
        onChange={(e) => onReason(e.target.value)}
      />
    </div>
  );
}

export function StaffQuestions({
  questions,
}: {
  questions: Array<{ id: string; prompt: string }>;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Questions staff will complete with the client ({questions.length})
      </p>
      <ol className="list-decimal pl-5 space-y-2.5 text-sm leading-relaxed marker:text-muted-foreground">
        {questions.map((q) => (
          <li key={q.id} className="pl-1">
            {q.prompt}
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
        Staff complete these together with the person and attest the responses reflect the
        individual's own perspective.
      </p>
    </div>
  );
}
