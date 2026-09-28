import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { addStaffNote, listStaffNotes } from "@/lib/team-members/notes.functions";
import {
  STAFF_NOTE_KINDS,
  STAFF_NOTE_KIND_LABEL,
  STAFF_NOTE_MAX,
  checkNoteBody,
  staffNotesQueryKey,
  type StaffNoteKind,
} from "@/lib/team-members/staff-notes";

const KIND_TONE: Record<StaffNoteKind, string> = {
  note: "border-border bg-muted text-muted-foreground",
  praise:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  concern:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
};

/**
 * Private notes about a team member. Newest first; no edit and no delete.
 * The page shows this tab only with Hire & deactivate View; the composer only
 * with Edit (the server checks both).
 */
export function NotesTab({
  orgId,
  staffId,
  canAdd,
}: {
  orgId: string;
  staffId: string;
  canAdd: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listStaffNotes);
  const addFn = useServerFn(addStaffNote);
  const [kind, setKind] = useState<StaffNoteKind>("note");
  const [body, setBody] = useState("");

  const notesQ = useQuery({
    queryKey: staffNotesQueryKey(orgId, staffId),
    queryFn: () => listFn({ data: { organizationId: orgId, staffId } }),
  });

  const add = useMutation({
    mutationFn: async () => {
      const checked = checkNoteBody(body);
      if (!checked.ok) throw new Error(checked.error);
      return addFn({ data: { organizationId: orgId, staffId, kind, body: checked.body } });
    },
    onSuccess: () => {
      setBody("");
      setKind("note");
      toast.success("Note added");
      void qc.invalidateQueries({ queryKey: staffNotesQueryKey(orgId, staffId) });
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not add the note")),
  });

  return (
    <div className="space-y-4" data-testid="notes-tab">
      <p className="text-xs text-muted-foreground">
        Private to people who manage hiring. Notes can't be edited or deleted.
      </p>
      {canAdd ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as StaffNoteKind)}
            className="flex flex-wrap gap-4"
            aria-label="Kind"
          >
            {STAFF_NOTE_KINDS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={k} /> {STAFF_NOTE_KIND_LABEL[k]}
              </label>
            ))}
          </RadioGroup>
          <div className="space-y-1">
            <Label htmlFor="staff-note-body" className="sr-only">
              Note
            </Label>
            <Textarea
              id="staff-note-body"
              value={body}
              maxLength={STAFF_NOTE_MAX}
              rows={3}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a note…"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={add.isPending || !body.trim()} onClick={() => add.mutate()}>
              {add.isPending ? "Adding…" : "Add note"}
            </Button>
          </div>
        </section>
      ) : null}

      {notesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notesQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {safeErrorMessage(notesQ.error, "Could not load notes.")}
        </p>
      ) : !notesQ.data?.length ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="divide-y rounded-2xl border border-border bg-card">
          {notesQ.data.map((n) => (
            <li key={n.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    KIND_TONE[n.kind],
                  )}
                >
                  {STAFF_NOTE_KIND_LABEL[n.kind]}
                </span>
                <span className="font-medium text-foreground">{n.authorName}</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-line text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
