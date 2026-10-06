import type { ClientListRow } from "@/lib/clients/list";

/** Shared row props for the phone cards and the desktop table. */
export type ClientListViewProps = {
  rows: ClientListRow[];
  discharged: boolean;
  canEditClients: boolean;
  reactivate: {
    isPending: boolean;
    variables: string | undefined;
    mutate: (clientId: string) => void;
  };
  onOpenClient: (clientId: string) => void;
  onOpenDraft: (subjectId: string) => void;
};

/** Row clicks open the client unless the click landed on a control. */
export function isRowControlClick(target: EventTarget): boolean {
  const t = target as HTMLElement;
  return !!t.closest(
    'a,button,input,select,textarea,[role="menuitem"],[role="menu"],[data-no-row-nav]',
  );
}
