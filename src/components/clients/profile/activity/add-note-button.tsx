// "Add note" on the profile header: writes an office note without leaving
// the current section.

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OfficeNoteComposer } from "./office-note-composer";

export function AddNoteButton({ orgId, clientId }: { orgId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="client-header-add-note">
        <StickyNote className="h-4 w-4" /> Add note
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add an office note</DialogTitle>
            <DialogDescription>
              Only people who can edit clients see office notes. They show under Activity.
            </DialogDescription>
          </DialogHeader>
          <OfficeNoteComposer orgId={orgId} clientId={clientId} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
