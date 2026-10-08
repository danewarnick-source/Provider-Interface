// The progress summary as a document, laid out like the support strategies
// document: provider and title, the draft mark, the details, then each goal
// → "Support:" / "Support details:" → "Progress / summary of services" → the
// evidence pulled for that goal; then General, Incidents and General notes.
// Editable in place (the editor) or read-only (the preview and a finalized
// summary). Built from buildSummaryDoc.

import type { ReactNode } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NO_PROGRESS_TEXT,
  evidenceHeading,
  manualIncidentLine,
  type ManualIncident,
  type SummaryDoc,
  type SummaryEditorState,
} from "@/lib/progress-summary-doc";
import type { FieldKey } from "@/lib/progress-summary-review";

export interface DocEditing {
  editor: SummaryEditorState;
  setEditor: (fn: (prev: SummaryEditorState) => SummaryEditorState) => void;
  /** Goal ids in the same order as doc.goals. */
  goalIds: string[];
  disabled: boolean;
  /** Draft with Nectar, Undo and the suggestion for one box, shown under it. */
  review?: (field: FieldKey) => ReactNode;
}

const Kicker = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

function EvidenceList({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-0.5">
      <Kicker>{evidenceHeading(lines.length)}</Kicker>
      {lines.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None.</p>
      )}
    </div>
  );
}

const fieldClass =
  "min-h-[72px] border-dashed bg-transparent text-sm [field-sizing:content] focus-visible:bg-background";

export function SummaryDocument({ doc, edit }: { doc: SummaryDoc; edit?: DocEditing }) {
  const set = edit?.setEditor;
  const setIncident = (id: string, patch: Partial<ManualIncident>) =>
    set?.((p) => ({
      ...p,
      incidents: p.incidents.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  return (
    <div
      className="space-y-4 rounded-xl border border-hive-border bg-hive-surface p-4 text-sm"
      data-testid="summary-document"
    >
      <div className="border-b border-hive-ink pb-2">
        <p className="text-xs font-medium text-muted-foreground">{doc.provider}</p>
        <p className="text-lg font-semibold text-hive-ink">{doc.title}</p>
        {doc.draftMark ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            <Sparkles className="size-3" /> {doc.draftMark}
          </p>
        ) : null}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {doc.facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {k}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {doc.goals.map((g, i) => {
        const id = edit?.goalIds[i];
        return (
          <section key={id ?? i} className="space-y-2 border-t border-hive-border pt-3">
            <Kicker>Goal {i + 1}</Kicker>
            <p className="font-semibold text-hive-ink">{g.goal}</p>
            {g.supports.map((s, j) => (
              <div key={j} className="space-y-0.5 pl-2">
                <p className="font-medium">Support: {s.support}</p>
                {s.details ? (
                  <p className="text-xs text-muted-foreground">Support details: {s.details}</p>
                ) : null}
              </div>
            ))}
            <div className="space-y-1 pl-2">
              <Kicker>Progress / summary of services</Kicker>
              {edit && id ? (
                <>
                  <Textarea
                    value={edit.editor.goals[id] ?? ""}
                    onChange={(e) =>
                      set?.((p) => ({ ...p, goals: { ...p.goals, [id]: e.target.value } }))
                    }
                    disabled={edit.disabled}
                    className={fieldClass}
                    placeholder="Progress on this goal…"
                    data-testid={`summary-goal-${id}`}
                  />
                  {edit.review?.(`goal:${id}`)}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{g.progress || NO_PROGRESS_TEXT}</p>
              )}
            </div>
            {edit && !g.evidence.length ? null : (
              <div className="pl-2">
                <EvidenceList lines={g.evidence} />
              </div>
            )}
          </section>
        );
      })}

      {doc.general.evidence.length ? (
        <section className="space-y-2 border-t border-hive-border pt-3">
          <p className="font-semibold text-hive-ink">General</p>
          <p className="text-xs text-muted-foreground">Not tied to a goal.</p>
          <EvidenceList lines={doc.general.evidence} />
        </section>
      ) : null}

      <section className="space-y-2 border-t border-hive-border pt-3">
        <p className="font-semibold text-hive-ink">
          Incidents (
          {doc.incidents.records.length +
            (edit ? edit.editor.incidents.length : doc.incidents.manual.length)}
          )
        </p>
        {doc.incidents.records.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {doc.incidents.records.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        ) : null}
        {edit ? (
          <>
            {edit.editor.incidents.map((m) => (
              <div
                key={m.id}
                className="grid gap-1.5 rounded-lg border border-dashed p-2 sm:grid-cols-[9rem_1fr]"
              >
                <Input
                  type="date"
                  value={m.date}
                  onChange={(e) => setIncident(m.id, { date: e.target.value })}
                  disabled={edit.disabled}
                  aria-label="Incident date"
                />
                <Input
                  value={m.what}
                  onChange={(e) => setIncident(m.id, { what: e.target.value })}
                  disabled={edit.disabled}
                  placeholder="What happened"
                />
                <Input
                  className="sm:col-span-2"
                  value={m.followUp}
                  onChange={(e) => setIncident(m.id, { followUp: e.target.value })}
                  disabled={edit.disabled}
                  placeholder="Follow-up"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={edit.disabled}
              onClick={() =>
                set?.((p) => ({
                  ...p,
                  incidents: [
                    ...p.incidents,
                    { id: crypto.randomUUID(), date: "", what: "", followUp: "" },
                  ],
                }))
              }
            >
              <Plus className="size-3.5 mr-1" /> Add incident
            </Button>
            <Textarea
              value={edit.editor.incidentNotes}
              onChange={(e) => set?.((p) => ({ ...p, incidentNotes: e.target.value }))}
              disabled={edit.disabled}
              className={fieldClass}
              placeholder="About the incidents this period…"
            />
            {edit.review?.("incidentNotes")}
          </>
        ) : (
          <>
            {doc.incidents.manual.length ? (
              <ul className="list-disc space-y-0.5 pl-5 text-xs">
                {doc.incidents.manual.map((m) => (
                  <li key={m.id}>{manualIncidentLine(m)}</li>
                ))}
              </ul>
            ) : null}
            {doc.incidents.notes ? (
              <p className="whitespace-pre-wrap">{doc.incidents.notes}</p>
            ) : null}
            {!doc.incidents.records.length &&
            !doc.incidents.manual.length &&
            !doc.incidents.notes ? (
              <p className="text-xs text-muted-foreground">No incidents this period.</p>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-2 border-t border-hive-border pt-3">
        <p className="font-semibold text-hive-ink">General notes</p>
        {edit ? (
          <>
            <Textarea
              value={edit.editor.general}
              onChange={(e) => set?.((p) => ({ ...p, general: e.target.value }))}
              disabled={edit.disabled}
              className={fieldClass}
              placeholder="Overall status and services this period…"
              data-testid="summary-general"
            />
            {edit.review?.("general")}
          </>
        ) : (
          <p className="whitespace-pre-wrap">{doc.general.notes || "None."}</p>
        )}
      </section>

      {doc.signoff.length ? (
        <div className="space-y-1 border-t border-hive-border pt-3 text-[11px] text-muted-foreground">
          {doc.signoff.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
