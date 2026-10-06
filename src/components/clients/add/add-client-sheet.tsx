import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
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
import { findClientByMedicaidId, loadImportDraft } from "@/lib/clients/create.functions";
import {
  emptyAddClientForm,
  formProblems,
  prefillFromPcsp,
  type AddClientForm,
  type FilledField,
} from "@/lib/clients/create";
import { AddCodesFields } from "./add-codes-fields";
import { AddContactsFields } from "./add-contacts-fields";
import { AddIdentityFields } from "./add-identity-fields";
import { FillFromPcsp } from "./fill-from-pcsp";
import { useAddClient } from "./use-add-client";

type Existing = { id: string; name: string };

/** Add client: one page. Imported drafts (draftId) open the same form prefilled. */
export function AddClientSheet({
  organizationId,
  open,
  draftId,
  homes = [],
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  draftId: string | null;
  homes?: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<AddClientForm>(emptyAddClientForm);
  const [filled, setFilled] = useState<FilledField[]>([]);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const set = (patch: Partial<AddClientForm>) => {
    if ("medicaid_id" in patch) setDuplicate(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const loadDraftFn = useServerFn(loadImportDraft);
  const draftQ = useQuery({
    enabled: open && !!draftId,
    queryKey: ["clients", "import-draft", draftId],
    queryFn: () => loadDraftFn({ data: { organizationId, subjectId: draftId! } }),
  });
  useEffect(() => {
    if (!open) return;
    setForm(draftQ.data?.form ?? emptyAddClientForm());
    setFilled([]);
    setDuplicate(null);
  }, [open, draftId, draftQ.data]);

  const dupFn = useServerFn(findClientByMedicaidId);
  async function checkDuplicate() {
    if (!form.medicaid_id.trim()) return;
    try {
      setDuplicate(await dupFn({ data: { organizationId, medicaidId: form.medicaid_id } }));
    } catch {
      /* the save checks again */
    }
  }

  const save = useAddClient(organizationId, {
    draftId,
    onDone: () => onOpenChange(false),
    onDuplicate: setDuplicate,
  });
  function submit() {
    const problems = formProblems(form);
    if (problems.length) {
      toast.error(`Please complete: ${problems.join(", ")}.`);
      return;
    }
    save.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (menuOpen) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {draftId ? `Finish setup — ${draftQ.data?.name ?? "imported client"}` : "Add client"}
          </DialogTitle>
          <DialogDescription>
            Fields marked * are required. Everything else can be added later on the profile.
          </DialogDescription>
        </DialogHeader>
        {draftId && draftQ.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the imported draft…
          </div>
        ) : draftQ.isError ? (
          <p className="py-6 text-sm text-rose-700">{(draftQ.error as Error).message}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>Have their PCSP? Fill the form from it, then check each tagged field.</span>
              <FillFromPcsp
                organizationId={organizationId}
                onRead={(p) => {
                  const out = prefillFromPcsp(form, p);
                  setForm(out.form);
                  setFilled((f) => [...new Set([...f, ...out.filled])]);
                  toast.success(
                    out.filled.length
                      ? "Filled from the PCSP. Check the tagged fields."
                      : "Nothing new to fill from this PCSP.",
                  );
                }}
              />
            </div>
            <AddIdentityFields
              form={form}
              set={set}
              filled={filled}
              homes={homes}
              duplicate={duplicate}
              onMedicaidBlur={() => void checkDuplicate()}
            />
            <AddContactsFields form={form} set={set} filled={filled} />
            <AddCodesFields form={form} set={set} filled={filled} onMenuOpenChange={setMenuOpen} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={save.isPending || !!duplicate || (!!draftId && !draftQ.data)}
            data-testid="add-client-save"
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
