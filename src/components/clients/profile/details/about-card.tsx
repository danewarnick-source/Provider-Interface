// "About <first name>": who the person is, in plain words — the approved
// Nectar summary of their documents (each bullet traced to a document), then
// the agency's own notes. Editors draft or refresh with Nectar and approve;
// everyone else reads it.

import { Loader2, Smile, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { boldLead, summarySources } from "@/lib/clients/about-me";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { AboutEditor } from "./about-editor";
import { AgencyNotes } from "./agency-notes";
import { useAboutMe } from "./use-about-me";

export function AboutCard({
  orgId,
  clientId,
  firstName,
  agencyNotes,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  firstName: string;
  agencyNotes: string | null;
  onChanged: () => void;
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const { view, draft, setDraft, startDraft, approve } = useAboutMe(orgId, clientId);
  const summary = view.data?.summary ?? null;
  const docs = view.data?.docs ?? [];
  const label = summary ? "Refresh with Nectar" : "Draft with Nectar";
  const nectarButton = (variant: "default" | "outline") => (
    <Button
      variant={variant}
      onClick={() => startDraft.mutate()}
      disabled={startDraft.isPending}
      data-testid="client-about-draft"
    >
      {startDraft.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {startDraft.isPending ? "Nectar is reading…" : label}
    </Button>
  );

  return (
    <SectionCard
      icon={Smile}
      tone="profile"
      title={`About ${firstName || "this client"}`}
      description="Who they are, in plain words. Read this before your first shift."
      actions={canEdit && !draft && summary ? nectarButton("default") : null}
      testId="client-about"
    >
      {draft ? (
        <AboutEditor
          items={draft.items}
          docs={docs}
          skipped={draft.skipped}
          saving={approve.isPending}
          onCancel={() => setDraft(null)}
          onApprove={(items) => approve.mutate(items)}
        />
      ) : view.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : summary ? (
        <>
          {canEdit && view.data?.newDocs ? (
            <EmptyState action={nectarButton("outline")} testId="client-about-new-docs">
              New documents since this summary. Refresh with Nectar?
            </EmptyState>
          ) : null}
          <ul className="mt-1 grid gap-x-8 gap-y-3 md:grid-cols-2" data-testid="client-about-items">
            {summary.items.map((item, i) => {
              const { lead, rest } = boldLead(item.text);
              return (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-hive-gold"
                  />
                  <span>
                    {lead ? <strong className="font-semibold text-hive-ink">{lead}</strong> : null}
                    {rest}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground" data-testid="client-about-footer">
            {summarySources(summary.items, docs)} · Approved{" "}
            {formatDate(todayYmd(new Date(summary.approvedAt)))} by {summary.approverName}
          </p>
        </>
      ) : (
        <EmptyState action={canEdit ? nectarButton("default") : null}>
          {canEdit
            ? "No summary yet. Nectar can draft one from the PCSP, BSP, face sheet and other files in the Client file."
            : "No summary yet."}
        </EmptyState>
      )}
      {draft ? null : (
        <AgencyNotes
          orgId={orgId}
          clientId={clientId}
          value={agencyNotes}
          canEdit={canEdit}
          onChanged={onChanged}
        />
      )}
    </SectionCard>
  );
}
