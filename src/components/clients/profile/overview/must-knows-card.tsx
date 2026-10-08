// Must-knows: the few things every team member needs before working with
// this client (clients.special_directions), as headings and bullets. Staff
// see the same text on shift. Editors draft with Nectar from the client's
// documents and approve, or write the text by hand.

import { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { approvalLine } from "@/lib/clients/must-knows";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { MustKnowsReview } from "./must-knows-review";
import { MustKnowsText } from "./must-knows-text";
import { useMustKnows } from "./use-must-knows";

export function MustKnowsCard({
  orgId,
  clientId,
  text,
}: {
  orgId: string;
  clientId: string;
  text: string | null;
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const { view, draft, setDraft, startDraft, approve, save } = useMustKnows(orgId, clientId);
  const [typing, setTyping] = useState<string | null>(null);
  const approved = approvalLine(view.data?.approval ?? null, text, (iso) =>
    formatDate(todayYmd(new Date(iso))),
  );
  const idle = canEdit && !draft && typing === null;
  const nectarButton = (
    <Button
      variant={text ? "outline" : "default"}
      onClick={() => startDraft.mutate()}
      disabled={startDraft.isPending}
      data-testid="client-must-knows-draft"
    >
      {startDraft.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {startDraft.isPending ? "Nectar is reading…" : "Draft with Nectar"}
    </Button>
  );

  return (
    <SectionCard
      icon={AlertTriangle}
      tone={text ? "profile" : "neutral"}
      title="Must-knows"
      description="Health, behaviors, trauma and supports every team member needs to know first."
      className={text ? "border-hive-gold" : undefined}
      testId="client-must-knows"
      actions={
        idle && text ? (
          <div className="flex flex-wrap items-center gap-2">
            {nectarButton}
            <EditButton label="Edit must-knows" onClick={() => setTyping(text)} />
          </div>
        ) : null
      }
    >
      {draft ? (
        <MustKnowsReview
          items={draft.items}
          docs={view.data?.docs ?? []}
          skipped={draft.skipped}
          saving={approve.isPending}
          onCancel={() => setDraft(null)}
          onApprove={(items) => approve.mutate(items)}
        />
      ) : typing !== null ? (
        <>
          <Textarea
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            rows={8}
            aria-label="Must-knows"
            placeholder={"Health:\n- Allergic to peanuts. Carry the EpiPen on outings."}
          />
          <SaveBar
            onCancel={() => setTyping(null)}
            onSave={() => save.mutate(typing, { onSuccess: () => setTyping(null) })}
            saving={save.isPending}
            saveLabel="Save must-knows"
          />
        </>
      ) : text ? (
        <>
          <MustKnowsText text={text} />
          {approved ? (
            <p
              className="mt-4 text-xs text-muted-foreground"
              data-testid="client-must-knows-approved"
            >
              {approved}
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <div className="flex flex-wrap gap-2">
                {nectarButton}
                <Button variant="outline" onClick={() => setTyping("")}>
                  Write must-knows
                </Button>
              </div>
            ) : null
          }
        >
          {canEdit
            ? "Nothing written yet. Nectar can draft them from the PCSP, BSP, medical records and other files in the Client file."
            : "Nothing written yet."}
        </EmptyState>
      )}
    </SectionCard>
  );
}
