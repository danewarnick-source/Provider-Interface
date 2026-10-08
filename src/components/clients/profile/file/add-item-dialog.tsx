// "Add one item": a single document from the Evidence client catalog
// (applyEvidenceRequirements, marked added by hand), or the agency's own with
// a name and a short explanation (upsertEvidenceRequirement). Added items
// never follow the client's codes.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyEvidenceRequirements, upsertEvidenceRequirement } from "@/lib/evidence.functions";
import { EVIDENCE_REQUIREMENTS } from "@/lib/evidence/catalog";
import { RESIDENTIAL_ONLY_KEYS, hasResidentialCode } from "@/lib/clients/file-packs";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";

export function AddItemDialog({
  open,
  orgId,
  clientId,
  activeCodes,
  existingKeys,
  onClose,
  onSaved,
}: {
  open: boolean;
  orgId: string;
  clientId: string;
  activeCodes: readonly string[];
  existingKeys: ReadonlySet<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const applyFn = useServerFn(applyEvidenceRequirements);
  const customFn = useServerFn(upsertEvidenceRequirement);
  const [choice, setChoice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const residential = hasResidentialCode(activeCodes);
  const catalog = useMemo(
    () =>
      EVIDENCE_REQUIREMENTS.filter(
        (r) =>
          r.subject === "client" &&
          !existingKeys.has(r.key) &&
          !r.dualLink &&
          (residential || !RESIDENTIAL_ONLY_KEYS.has(r.key)),
      ),
    [existingKeys, residential],
  );
  const ready = choice === CUSTOM ? !!name.trim() && !!about.trim() : !!choice;

  async function save() {
    if (!choice) return;
    setSaving(true);
    try {
      if (choice === CUSTOM) {
        await customFn({
          data: {
            organizationId: orgId,
            subjectType: "client",
            subjectIds: [clientId],
            title: name.trim(),
            description: about.trim(),
            evidenceType: "upload",
          },
        });
      } else {
        await applyFn({
          data: {
            organizationId: orgId,
            subjectType: "client",
            subjectIds: [clientId],
            requirementKeys: [choice],
            addedByHand: true,
          },
        });
      }
      toast.success("Added to the client file");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg" data-testid="add-item-dialog">
        <DialogHeader>
          <DialogTitle>Add one item</DialogTitle>
          <DialogDescription>
            Pick a document from the list, or add your own with a short explanation.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[45vh] space-y-2 overflow-y-auto" role="radiogroup" aria-label="Item">
          {[
            ...catalog.map((r) => ({ key: r.key, title: r.title, why: r.why })),
            {
              key: CUSTOM,
              title: "Something else",
              why: "Your agency's own document, with a name and a short explanation.",
            },
          ].map((r) => (
            <li key={r.key}>
              <button
                type="button"
                role="radio"
                aria-checked={choice === r.key}
                onClick={() => setChoice(r.key)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left",
                  choice === r.key ? "border-hive-ink bg-hive-gold-soft" : "border-hive-border",
                )}
              >
                <span className="block text-sm font-medium text-hive-ink">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.why}</span>
              </button>
            </li>
          ))}
        </ul>
        {choice === CUSTOM && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-item-name" className="text-xs">
                Name
              </Label>
              <Input
                id="add-item-name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-item-about" className="text-xs">
                What it is and why you keep it
              </Label>
              <Textarea
                id="add-item-about"
                rows={2}
                maxLength={500}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !ready}>
            {saving ? "Adding…" : "Add to the client file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
