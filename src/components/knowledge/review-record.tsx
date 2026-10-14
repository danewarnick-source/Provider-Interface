import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  formatInstant,
  recordStatus,
  REVIEW_RECORD_PRINT_CSS,
  REVIEW_RECORD_PRINT_ID,
} from "@/lib/nectar/library/knowledge-view";
import { getStaffReviewRecord } from "@/lib/nectar/library/library.functions";
import { cn } from "@/lib/utils";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { knowledgeKey } from "./use-knowledge";

type StaffRecord = Awaited<ReturnType<typeof getStaffReviewRecord>>;

function RecordLines({ record }: { record: StaffRecord }) {
  return (
    <ul className="divide-y divide-border">
      {record.policies.length === 0 ? (
        <li className="py-2 text-sm text-muted-foreground">
          No published policies are meant for them.
        </li>
      ) : null}
      {record.policies.map((p) => (
        <li key={p.documentId} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>
            {p.title} (current v{p.version})
          </span>
          <span
            className={cn(
              "font-semibold",
              p.reviewedAt ? "text-[var(--hive-ok-fg)]" : "text-amber-800",
            )}
          >
            {recordStatus(p.reviewedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A copy of the record outside the app, shown only when printing (print stylesheet). */
function PrintCopy({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div id={REVIEW_RECORD_PRINT_ID}>
      <style>{REVIEW_RECORD_PRINT_CSS}</style>
      {children}
    </div>,
    host,
  );
}

/** A team member's printable policy review record: policy, current version, reviewed date. */
export function ReviewRecord({
  orgId,
  userId,
  onClose,
}: {
  orgId: string;
  userId: string;
  onClose: () => void;
}) {
  const fn = useServerFn(getStaffReviewRecord);
  const q = useQuery({
    queryKey: knowledgeKey(orgId, "record", userId),
    queryFn: () => fn({ data: { organizationId: orgId, userId } }),
  });
  const printed = `Printed ${formatInstant(new Date().toISOString())}`;
  const title = `Policy review record: ${q.data?.person.name ?? ""}`;

  return (
    <section
      aria-label="Policy review record"
      className="space-y-3 rounded-xl border-2 border-[var(--hive-text)] bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--hive-text)]">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()} disabled={!q.data}>
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{printed}</p>
      {q.isLoading ? <KnowledgeLoading /> : null}
      {q.error ? <KnowledgeError error={q.error} /> : null}
      {q.data ? (
        <>
          <RecordLines record={q.data} />
          <PrintCopy>
            <h1 style={{ fontSize: "16pt", margin: "0 0 4pt" }}>{title}</h1>
            <p style={{ margin: "0 0 12pt" }}>{printed}</p>
            <RecordLines record={q.data} />
          </PrintCopy>
        </>
      ) : null}
    </section>
  );
}
