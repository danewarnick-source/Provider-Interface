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
import { PcspReview } from "@/components/clients/profile/plans/pcsp-review";
import { PcspReadFailed, PcspReadSummary } from "@/components/clients/shared/pcsp-read-notes";
import { AddClientDone } from "./add-client-done";
import { AddClientStart } from "./add-client-start";
import { AddCodesFields } from "./add-codes-fields";
import { AddContactsFields } from "./add-contacts-fields";
import { AddIdentityFields } from "./add-identity-fields";
import { FillFromPcsp } from "./fill-from-pcsp";
import { useAddClient } from "./use-add-client";
import { useNewClientPcsp, type NewClientSaved } from "./use-new-client-pcsp";

type Existing = { id: string; name: string };
type Step = "start" | "form" | "review" | "done";

/**
 * Add client: "Start from their PCSP" (form → PCSP review → one save of the
 * client and the plan) or "Enter by hand" (one form page), or the link to the
 * spreadsheet import.
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
  const [step, setStep] = useState<Step>("start");
  const [form, setForm] = useState<AddClientForm>(emptyAddClientForm);
  const [filled, setFilled] = useState<FilledField[]>([]);
  const [duplicate, setDuplicate] = useState<Existing | null>(null);
  const [saved, setSaved] = useState<NewClientSaved | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pcsp = useNewClientPcsp(organizationId);
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
    setSaved(null);
    pcsp.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function readPcsp(file: File | null) {
    const read = file ? await pcsp.pick(file) : await pcsp.retry();
    if (!read) return;
    const out = prefillFromPcsp({ ...form, codes: [] }, read.parse);
    setForm(out.form);
    setFilled((f) => [...new Set([...f, ...out.filled])]);
    setStep("form");
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
    if (pcsp.read) setStep("review");
    else save.mutate(form);
  }
  async function saveWithPlan() {
    const res = await pcsp.save(form);
    if (res?.status === "duplicate") {
      setDuplicate(res.existing);
      setStep("form");
    } else if (res?.status === "created") {
      setSaved(res);
      setStep("done");
    }
  }

  if (open && step === "review" && pcsp.read && pcsp.review) {
    return (
      <PcspReview
        read={pcsp.read}
        review={pcsp.review}
        onChange={pcsp.setReview}
        saving={pcsp.saving}
        error={pcsp.saveError}
        onConfirm={() => void saveWithPlan()}
        onClose={() => setStep("form")}
        confirmLabel="Save client and plan"
        showPerson={false}
      />
    );
  }

  const failed = pcsp.failed && (
    <PcspReadFailed message={pcsp.failed} retrying={pcsp.reading} onRetry={() => void readPcsp(null)} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (menuOpen) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{step === "done" ? "Client added" : "Add client"}</DialogTitle>
          <DialogDescription>
            {step === "start"
              ? "How do you want to start?"
              : step === "done"
                ? "Here's what was saved."
                : "Fields marked * are required. Everything else can be added later on the profile."}
          </DialogDescription>
        </DialogHeader>
        {step === "done" && saved && pcsp.review ? (
          <AddClientDone
            saved={saved}
            firstName={form.first_name.trim()}
            plan={pcsp.review.plan}
            onClose={() => onOpenChange(false)}
          />
        ) : step === "start" ? (
          <div className="space-y-3">
            <AddClientStart
              reading={pcsp.reading}
              onPcsp={(file) => void readPcsp(file)}
              onByHand={() => setStep("form")}
              onSpreadsheet={() => {
                onOpenChange(false);
                onImportSpreadsheet();
              }}
            />
            {failed}
          </div>
        ) : (
          <div className="space-y-5">
            {pcsp.read ? (
              <PcspReadSummary parse={pcsp.read.parse} agencyName={pcsp.read.agencyName} />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>Have their PCSP? Start from it instead, then check each tagged field.</span>
                  <FillFromPcsp reading={pcsp.reading} onPick={(file) => void readPcsp(file)} />
                </div>
                {failed}
              </>
            )}
            <AddIdentityFields
              form={form}
              set={set}
              filled={filled}
              homes={homes}
              duplicate={duplicate}
              onMedicaidBlur={() => void checkDuplicate()}
            />
            <AddContactsFields form={form} set={set} filled={filled} />
            {pcsp.read ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Service codes, units, the plan year and goals come from the PCSP. You'll check them next.
              </p>
            ) : (
              <AddCodesFields form={form} set={set} onMenuOpenChange={setMenuOpen} />
            )}
          </div>
        )}
        {step !== "done" && (
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
                {pcsp.read ? "Next: check the PCSP" : "Save client"}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
