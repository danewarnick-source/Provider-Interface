import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  documentChip,
  documentMeta,
  documentNote,
  formatInstant,
  personReview,
  versionNote,
} from "@/lib/nectar/library/knowledge-view";
import { getLibraryDocument } from "@/lib/nectar/library/library.functions";
import { AudiencePanel } from "./audience-panel";
import { DocumentActions } from "./document-actions";
import { DocumentEditor } from "./document-editor";
import { DocumentSections, SidePanel, VersionsList } from "./document-sections";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import { ReviewMark, StatusChip } from "./status-chip";
import { knowledgeKey, useKnowledgeNav } from "./use-knowledge";

type LibraryDocument = Awaited<ReturnType<typeof getLibraryDocument>>;

/** Back to the tab the document was opened from. */
export function BackToKnowledge() {
  const nav = useKnowledgeNav();
  return (
    <Button variant="ghost" className="-ml-2 px-2" onClick={() => nav.home()}>
      <ArrowLeft aria-hidden="true" /> Back to Knowledge base
    </Button>
  );
}

/** A library document: its text, its status and actions, and who it's for and has reviewed it. */
export function DocumentView({
  orgId,
  documentId,
  canEdit,
}: {
  orgId: string;
  documentId: string;
  canEdit: boolean;
}) {
  const fn = useServerFn(getLibraryDocument);
  const q = useQuery({
    queryKey: knowledgeKey(orgId, "doc", documentId),
    queryFn: () => fn({ data: { organizationId: orgId, documentId } }),
  });
  return (
    <div className="space-y-4">
      <BackToKnowledge />
      {q.isLoading ? <KnowledgeLoading /> : null}
      {q.error ? <KnowledgeError error={q.error} /> : null}
      {q.data ? (
        <DocumentBody key={q.data.document.id} orgId={orgId} data={q.data} canEdit={canEdit} />
      ) : null}
    </div>
  );
}

function DocumentBody({
  orgId,
  data,
  canEdit,
}: {
  orgId: string;
  data: LibraryDocument;
  canEdit: boolean;
}) {
  const nav = useKnowledgeNav();
  const [editing, setEditing] = useState(false);
  const doc = data.document;
  const superseded = !!doc.superseded_by;
  const status = doc.library_status;
  const note = documentNote({ status, pastReview: doc.pastReview, superseded });
  const meta = documentMeta({
    group: doc.library_group,
    version: doc.version,
    owner: doc.owner_name ?? doc.uploaded_by_name,
    reviewDue: doc.review_due,
    slot: doc.slot,
  });
  const forThem = data.people.filter((p) => p.review.status !== "not_for_them");
  const versions = data.versions.map((v) => ({
    id: v.id,
    label: `v${v.version} · ${formatInstant(v.created_at)}`,
    note: versionNote(v),
  }));

  return (
    <div className="flex flex-wrap items-start gap-5">
      <article className="min-w-0 flex-[999_1_460px] space-y-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--hive-text)] sm:text-2xl">
            {doc.title}
          </h1>
          <StatusChip chip={documentChip({ status, pastReview: doc.pastReview })} />
        </div>
        <p className="text-sm text-muted-foreground">{meta}</p>
        {note ? (
          <p className="rounded-lg bg-[var(--hive-muted-surface)] px-3 py-2 text-sm text-[var(--hive-text)]">
            {note}
          </p>
        ) : null}
        {canEdit && !superseded && !editing ? (
          <DocumentActions orgId={orgId} doc={doc} onEdit={() => setEditing(true)} />
        ) : null}
        {data.fileUrl && doc.mime_type !== "text/plain" ? (
          <a
            href={data.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-semibold text-[var(--hive-text)] underline underline-offset-2"
          >
            Open the file ({doc.file_name})
          </a>
        ) : null}
        {editing ? (
          <DocumentEditor
            orgId={orgId}
            doc={doc}
            text={data.text}
            onDone={() => setEditing(false)}
          />
        ) : (
          <DocumentSections sections={data.sections} parseStatus={doc.parse_status} />
        )}
      </article>
      <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
        <SidePanel title="Versions">
          <VersionsList versions={versions} currentId={doc.id} onOpen={nav.openDocument} />
        </SidePanel>
        {!superseded && status !== "archived" ? (
          <AudiencePanel
            orgId={orgId}
            documentId={doc.id}
            audienceAll={doc.audience_all !== false}
            people={data.people}
            canEdit={canEdit}
          />
        ) : null}
        {doc.reviewable && (status === "published" || superseded) ? (
          <SidePanel
            title={`Reviewed v${doc.version}: ${data.reviewed.reviewed} of ${data.reviewed.total}`}
          >
            {forThem.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody is checked yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {forThem.map((p) => (
                  <li key={p.userId} className="flex justify-between gap-2">
                    <span>{p.name}</span>
                    <ReviewMark mark={personReview(p.review)} />
                  </li>
                ))}
              </ul>
            )}
          </SidePanel>
        ) : null}
      </aside>
    </div>
  );
}
