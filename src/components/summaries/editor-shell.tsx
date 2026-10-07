// The summary editor's frame: a dialog on /dashboard/summaries, a side panel
// in the client profile (closing it leaves the profile where it was).

import type { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function EditorShell({
  panel,
  onClose,
  children,
}: {
  panel: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (panel) {
    return (
      <Sheet
        open
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-hidden sm:max-w-5xl"
          data-testid="summary-side-panel"
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        {children}
      </DialogContent>
    </Dialog>
  );
}
