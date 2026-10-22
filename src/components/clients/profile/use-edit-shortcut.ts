// ?edit= on the client profile (the list's "+ Set home", "+ Add codes", …):
// open that one editor once the card is ready, and drop the flag (replace,
// not push) when the editor saves or cancels, so a refresh or Back doesn't
// reopen it. A viewer who can't edit just sees the card; the flag is dropped.

import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ClientEditTarget } from "@/lib/clients/profile-search";

export function useEditShortcut({
  clientId,
  target,
  canEdit,
  ready,
  open,
  enabled = true,
}: {
  clientId: string;
  target: ClientEditTarget;
  canEdit: boolean;
  /** The card has what it needs to open its editor. */
  ready: boolean;
  open: () => void;
  enabled?: boolean;
}): () => void {
  const search = useSearch({ strict: false }) as { edit?: string };
  const navigate = useNavigate();
  const wanted = enabled && search.edit === target;
  const handled = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const done = useCallback(() => {
    if (!wanted) return;
    void navigate({
      to: "/dashboard/clients/$clientId",
      params: { clientId },
      search: (prev) => ({ ...prev, edit: undefined }),
      replace: true,
    });
  }, [wanted, navigate, clientId]);

  useEffect(() => {
    if (!wanted || handled.current) return;
    if (!canEdit) {
      handled.current = true;
      done();
      return;
    }
    if (!ready) return;
    handled.current = true;
    openRef.current();
  }, [wanted, canEdit, ready, done]);

  return done;
}
