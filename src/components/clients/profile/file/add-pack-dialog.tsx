// "Add a pack": the client packs this client doesn't have yet, each with
// what it holds. Adding one saves the pack and its rows (addClientFilePack).

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLIENT_PACKS, packTriggerCodes } from "@/lib/clients/file-packs";

export function AddPackDialog({
  open,
  activePackKeys,
  pending,
  onClose,
  onAdd,
}: {
  open: boolean;
  activePackKeys: readonly string[];
  pending?: boolean;
  onClose: () => void;
  onAdd: (packKey: string) => void;
}) {
  const choices = CLIENT_PACKS.filter((p) => !activePackKeys.includes(p.key));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="add-pack-dialog">
        <DialogHeader>
          <DialogTitle>Add a pack</DialogTitle>
          <DialogDescription>
            A pack adds a set of documents to this client's file. Packs that follow a service code
            are added on their own when the code starts.
          </DialogDescription>
        </DialogHeader>
        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every pack is already on this client.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-hive-border overflow-y-auto">
            {choices.map((p) => {
              const codes = packTriggerCodes(p);
              return (
                <li key={p.key} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-hive-ink">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    {codes.length ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Usually for {codes.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 max-md:min-h-11"
                    disabled={pending}
                    onClick={() => onAdd(p.key)}
                  >
                    Add {p.title}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
