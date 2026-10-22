// The support strategies, open: grouped under each goal, every support shows
// its code badges and details (read-only, from the PCSP) and its "Support
// strategy" bullets, which have their own pencil to edit in place (one
// bullet per line). Empty ones say "Strategy needed"; supports whose codes
// need none say why (§1.24(5)). Nectar drafts are tagged until a person
// edits them or the strategies are approved. Each goal is its own bordered
// block with a bold title, each support a bordered card inside it.

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  groupByGoal,
  showsNectarTag,
  type StrategyStatus,
  type StrategyView,
} from "@/lib/clients/strategies/support-strategies";
import { MAX_BULLETS, MIN_BULLETS, strategyNeedText } from "@/lib/clients/strategies/strategy-rules";
import { EditButton, SaveBar } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { GOAL_BLOCK, GOAL_HEAD, GOAL_TITLE, SupportLines } from "./support-lines";

function StrategyItem({
  v,
  current,
  nectarTag,
  canEdit,
  saving,
  onSave,
}: {
  v: StrategyView;
  /** Show "Drafted by Nectar: review" (an unapproved Nectar draft). */
  nectarTag: boolean;
  /** The support is in the current PCSP. */
  current: boolean;
  canEdit: boolean;
  saving: boolean;
  onSave: (text: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const needed = v.need.kind === "needed";
  return (
    <li
      className="space-y-2 rounded-xl border border-hive-steel/50 bg-hive-surface p-3 shadow-sm"
      data-testid="support-strategy"
    >
      <div className="flex items-start gap-2">
        <SupportLines support={v.support} details={v.details} codes={v.codes} />
        {canEdit && needed && draft === null ? (
          <span className="ml-auto">
            <EditButton label="Edit this support strategy" onClick={() => setDraft(v.strategy)} />
          </span>
        ) : null}
      </div>
      {!current ? (
        <p className="text-xs text-muted-foreground">
          This support is no longer in the current PCSP.
        </p>
      ) : null}
      {!needed ? (
        <StatusTag tone="neutral">{strategyNeedText(v.need)}</StatusTag>
      ) : (
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Support strategy
            {nectarTag ? <StatusTag tone="info">Drafted by Nectar: review</StatusTag> : null}
          </p>
          {draft !== null ? (
            <>
              <Textarea
                rows={6}
                value={draft}
                aria-label="Support strategy"
                onChange={(e) => setDraft(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                One strategy per line, starting with "- " ({MIN_BULLETS}–{MAX_BULLETS} is best).
              </p>
              <SaveBar
                saving={saving}
                saveLabel="Save strategy"
                onCancel={() => setDraft(null)}
                onSave={() => void onSave(draft).then(() => setDraft(null))}
              />
            </>
          ) : v.bullets.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {v.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <StatusTag tone="profile">Strategy needed</StatusTag>
          )}
        </div>
      )}
    </li>
  );
}

export function SupportStrategiesList({
  views,
  status,
  currentIds,
  canEdit,
  saving,
  onSave,
}: {
  views: StrategyView[];
  /** Approved strategies don't show the Nectar draft tag. */
  status: StrategyStatus | null;
  currentIds: ReadonlySet<string>;
  canEdit: boolean;
  saving: boolean;
  onSave: (sectionId: string, text: string) => Promise<unknown>;
}) {
  return (
    <div className="space-y-4" data-testid="support-strategies-list">
      {groupByGoal(views).map((g, i) => (
        <div key={`${g.goal}-${i}`} className={GOAL_BLOCK} data-testid="support-strategy-goal">
          <div className={GOAL_HEAD}>
            <div className="mb-0.5 text-xs font-medium text-muted-foreground">Goal</div>
            <p className={GOAL_TITLE}>{g.goal || "Not linked to a goal"}</p>
          </div>
          <ul className="space-y-3 p-3">
            {g.items.map((v) => (
              <StrategyItem
                key={v.id}
                v={v}
                current={!v.supportId || currentIds.has(v.supportId)}
                nectarTag={showsNectarTag(v, status)}
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
