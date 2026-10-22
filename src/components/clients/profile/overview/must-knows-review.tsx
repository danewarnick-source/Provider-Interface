// Review Nectar's Must-knows draft: bullets under their headings, each
// editable with its source in small grey text and a Remove button. Nothing
// is saved until "Approve"; approving replaces the must-knows text.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AboutDocInfo } from "@/lib/clients/about-me";
import { MUST_KNOW_SECTIONS, mustKnowSource, type MustKnowItem } from "@/lib/clients/must-knows";
import { SaveBar } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";

export function MustKnowsReview({
  items: initial,
  docs,
  skipped,
  saving,
  onCancel,
  onApprove,
}: {
  items: MustKnowItem[];
  docs: AboutDocInfo[];
  skipped: string[];
  saving: boolean;
  onCancel: () => void;
  onApprove: (items: MustKnowItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  const kept = items.filter((i) => i.text.trim());
  const edit = (i: number, text: string) =>
    setItems((all) => all.map((x, j) => (j === i ? { ...x, text } : x)));
  return (
    <div data-testid="client-must-knows-review">
      <p className="mb-3 text-sm text-muted-foreground">
        Nectar drafted this from the client's documents and the must-knows already written. Check
        each bullet against its source, edit or remove it, then approve. Approving replaces the
        current must-knows.
      </p>
      {items.length === 0 ? (
        <EmptyState>
          Nectar found nothing critical in the documents. Upload the PCSP, BSP or medical records,
          then try again.
        </EmptyState>
      ) : (
        MUST_KNOW_SECTIONS.map(({ key, heading }) => {
          const rows = items.map((item, i) => ({ item, i })).filter((r) => r.item.section === key);
          if (!rows.length) return null;
          return (
            <section key={key} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-hive-ink">{heading}</h3>
              <ol className="space-y-3">
                {rows.map(({ item, i }) => (
                  <li key={i} className="space-y-1">
                    <Textarea
                      value={item.text}
                      rows={2}
                      aria-label={`${heading} bullet`}
                      onChange={(e) => edit(i, e.target.value)}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        From {mustKnowSource(item, docs)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="max-md:min-h-11"
                        onClick={() => setItems((all) => all.filter((_, j) => j !== i))}
                      >
                        Remove bullet
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}
      {skipped.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Skipped (no readable text, likely a scan): {skipped.join(", ")}
        </p>
      ) : null}
      <SaveBar
        onCancel={onCancel}
        onSave={() => onApprove(kept.map((i) => ({ ...i, text: i.text.trim() })))}
        saving={saving}
        saveLabel="Approve"
        disabled={!kept.length}
      />
    </div>
  );
}
