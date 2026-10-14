// Review Nectar's About draft: each bullet editable, its source in small grey
// text, Remove per bullet. Saving needs "Approve"; nothing is saved before.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sourceLabel, type AboutDocInfo, type AboutItem } from "@/lib/clients/about-me";
import { SaveBar } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";

export function AboutEditor({
  items: initial,
  docs,
  skipped,
  saving,
  onCancel,
  onApprove,
}: {
  items: AboutItem[];
  docs: AboutDocInfo[];
  skipped: string[];
  saving: boolean;
  onCancel: () => void;
  onApprove: (items: AboutItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  const kept = items.filter((i) => i.text.trim());
  return (
    <div data-testid="client-about-editor">
      <p className="mb-3 text-sm text-muted-foreground">
        Nectar drafted this from the client's documents. Check each bullet against its source, edit
        or remove it, then approve.
      </p>
      {items.length === 0 ? (
        <EmptyState>
          The documents don't say enough about who they are yet. Upload the PCSP or face sheet, then
          try again.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={`${item.source_doc_id}-${i}`} className="space-y-1">
              <Textarea
                value={item.text}
                rows={2}
                aria-label={`Bullet ${i + 1}`}
                onChange={(e) =>
                  setItems((all) =>
                    all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                  )
                }
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  From {sourceLabel(item, docs)}
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
      )}
      {skipped.length ? (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="client-about-skipped">
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
