import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  archiveLibraryDocument,
  publishLibraryDocument,
} from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { useRefreshKnowledge } from "./use-knowledge";

/** Publish (draft), Edit draft, Publish new version (published) and Archive. */
export function DocumentActions({
  orgId,
  doc,
  onEdit,
}: {
  orgId: string;
  doc: { id: string; title: string; library_status: string; reviewable: boolean };
  onEdit: () => void;
}) {
  const refresh = useRefreshKnowledge(orgId);
  const publishFn = useServerFn(publishLibraryDocument);
  const archiveFn = useServerFn(archiveLibraryDocument);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const ids = { organizationId: orgId, documentId: doc.id };
  const publish = useMutation({
    mutationFn: () => publishFn({ data: ids }),
    onSuccess: async () => {
      await refresh();
      toast.success(
        doc.reviewable ? "Published. The people it's for are asked to review it." : "Published.",
      );
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not publish the document.")),
  });
  const archive = useMutation({
    mutationFn: () => archiveFn({ data: ids }),
    onSuccess: async () => {
      setConfirmArchive(false);
      await refresh();
      toast.success("Archived. It stays in the library with its versions and reviews.");
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not archive the document.")),
  });
  const isDraft = doc.library_status === "draft";
  if (!isDraft && doc.library_status !== "published") return null;
  const busy = publish.isPending || archive.isPending;

  return (
    <div className="flex flex-wrap gap-2">
      {isDraft ? (
        <>
          <Button
            onClick={() => publish.mutate()}
            disabled={busy}
            className="bg-[var(--hive-ok-fg)] text-white hover:bg-[var(--hive-ok-fg)]/90"
          >
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
          <Button variant="outline" onClick={onEdit} disabled={busy}>
            Edit draft
          </Button>
        </>
      ) : (
        <Button onClick={onEdit} disabled={busy}>
          Publish new version
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => setConfirmArchive(true)}
        disabled={busy}
        className="text-[var(--hive-danger-fg)]"
      >
        Archive
      </Button>
      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{doc.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Team members and Nectar stop seeing it. Nothing is deleted: it stays in the library as
              Archived, with its versions and reviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archive.isPending}
              onClick={(e) => {
                e.preventDefault();
                archive.mutate();
              }}
            >
              {archive.isPending ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
