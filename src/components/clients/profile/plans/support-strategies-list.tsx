// The support strategies, open: grouped under each goal, every support shows
// its code badges and details (read-only, from the PCSP) and its "Support
// strategy", which has its own pencil to edit in place. Empty ones say
// "Strategy needed".

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { groupByGoal, type StrategyView } from "@/lib/clients/support-strategies";
import { EditButton, SaveBar } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { SupportLines } from "./support-lines";

function StrategyItem({
  v,
  current,
  canEdit,
  saving,
  onSave,
}: {
  v: StrategyView;
  /** The support is in the current PCSP. */
  current: boolean;
  canEdit: boolean;
  saving: boolean;
  onSave: (text: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <li className="space-y-2 rounded-xl border border-hive-border p-3" data-testid="support-strategy">
      <div className="flex items-start gap-2">
        <SupportLines support={v.support} details={v.details} codes={v.codes} />
        {canEdit && draft === null ? (
          <span className="ml-auto">
            <EditButton label="Edit this support strategy" onClick={() => setDraft(v.strategy)} />
          </span>
        ) : null}
      </div>
      {!current ? (
        <p className="text-xs text-muted-foreground">This support is no longer in the current PCSP.</p>
      ) : null}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Support strategy</p>
        {draft !== null ? (
          <>
            <Textarea
              rows={4}
              value={draft}
              aria-label="Support strategy"
              onChange={(e) => setDraft(e.target.value)}
            />
            <SaveBar
              saving={saving}
              saveLabel="Save strategy"
              onCancel={() => setDraft(null)}
              onSave={() => void onSave(draft).then(() => setDraft(null))}
            />
          </>
        ) : v.strategy.trim() ? (
          <p className="whitespace-pre-wrap text-sm">{v.strategy}</p>
        ) : (
          <StatusTag tone="profile">Strategy needed</StatusTag>
        )}
      </div>
    </li>
  );
}

export function SupportStrategiesList({
  views,
  currentIds,
  canEdit,
  saving,
  onSave,
}: {
  views: StrategyView[];
  currentIds: ReadonlySet<string>;
  canEdit: boolean;
  saving: boolean;
  onSave: (sectionId: string, text: string) => Promise<unknown>;
}) {
  return (
    <div className="space-y-4" data-testid="support-strategies-list">
      {groupByGoal(views).map((g, i) => (
        <div key={`${g.goal}-${i}`} className="space-y-2">
          <p className="text-sm">
            <span className="font-medium text-hive-ink">Goal:</span> {g.goal || "Not linked to a goal"}
          </p>
          <ul className="space-y-2">
            {g.items.map((v) => (
              <StrategyItem
                key={v.id}
                v={v}
                current={!v.supportId || currentIds.has(v.supportId)}
                canEdit={canEdit}
                saving={saving}
                onSave={(text) => onSave(v.id, text)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
