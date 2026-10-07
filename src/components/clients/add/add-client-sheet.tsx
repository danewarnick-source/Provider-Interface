import { useEffect, useState } from "react";
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
import { findClientsByMedicaidIds } from "@/lib/clients/create.functions";
import {
  emptyAddClientForm,
  formProblems,
  prefillFromPcsp,
  type AddClientForm,
  type FilledField,
} from "@/lib/clients/create";
import type { PcspResult } from "@/lib/clients/pcsp/parser-shared";
import { AddClientStart } from "./add-client-start";
import { AddCodesFields } from "./add-codes-fields";
import { AddContactsFields } from "./add-contacts-fields";
import { AddIdentityFields } from "./add-identity-fields";
import { FillFromPcsp } from "./fill-from-pcsp";
import { useAddClient } from "./use-add-client";

type Existing = { id: string; name: string };

/**
 * Add client: first "Start from their PCSP" or "Enter by hand" (or the link to
 * the spreadsheet import), then one form page.
 */
export function AddClientSheet({
  organizationId,
  open,
  homes = [],
  onOpenChange,
  onImportSpreadsheet,
}: {
  organizationId: string;
  open: boolean;
  homes?: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onImportSpreadsheet: () => void;
}) {
  const [step, setStep] = useState<"start" | "form">("start");
  const [form, setForm] = useState<AddClientForm>(emptyAddClientForm);
  const [filled, setFilled] = useState<FilledField[]>([]);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const set = (patch: Partial<AddClientForm>) => {
    if ("medicaid_id" in patch) setDuplicate(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    if (!open) return;
    setStep("start");
    setForm(emptyAddClientForm());
    setFilled([]);
    setDuplicate(null);
  }, [open]);

  function fillFrom(p: PcspResult) {
    const out = prefillFromPcsp(form, p);
    setForm(out.form);
    setFilled((f) => [...new Set([...f, ...out.filled])]);
    setStep("form");
    toast.success(
      out.filled.length
        ? "Filled from the PCSP. Check the tagged fields."
        : "Nothing new to fill from this PCSP.",
    );
  }

  const dupFn = useServerFn(findClientsByMedicaidIds);
  async function checkDuplicate() {
    if (!form.medicaid_id.trim()) return;
    try {
      const [hit] = await dupFn({ data: { organizationId, medicaidIds: [form.medicaid_id] } });
      setDuplicate(hit ? { id: hit.id, name: hit.name } : null);
    } catch {
      /* the save checks again */
    }
  }

  const save = useAddClient(organizationId, {
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
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>
            {step === "start"
              ? "How do you want to start?"
              : "Fields marked * are required. Everything else can be added later on the profile."}
          </DialogDescription>
        </DialogHeader>
        {step === "start" ? (
          <AddClientStart
            organizationId={organizationId}
            onPcsp={fillFrom}
            onByHand={() => setStep("form")}
            onSpreadsheet={() => {
              onOpenChange(false);
              onImportSpreadsheet();
            }}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>Have their PCSP? Fill the form from it, then check each tagged field.</span>
              <FillFromPcsp organizationId={organizationId} onRead={fillFrom} />
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
          {step === "form" && (
            <Button
              onClick={submit}
              disabled={save.isPending || !!duplicate}
              data-testid="add-client-save"
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save client
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
