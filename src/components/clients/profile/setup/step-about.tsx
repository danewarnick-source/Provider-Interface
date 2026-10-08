// Setup step 1, About: date of birth, insurance and start date (saved like
// the Identity card, through updateClient), "Add a photo?" (the photo card,
// or "Person prefers no photo"), and the About draft from the PCSP.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateClient } from "@/lib/clients/writes.functions";
import { LabeledInput } from "@/components/clients/profile/cards/card-parts";
import { ClientPhotoCard } from "@/components/clients/profile/client-photo-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import type { SupportScope } from "@/lib/clients/support-scope";
import { useNoPhoto } from "./use-no-photo";
import { YesNo } from "./yes-no";

type Basics = { date_of_birth: string; insurance: string; admission_date: string };

export function StepAbout({
  orgId,
  data,
  scope,
  onDraftAbout,
}: {
  orgId: string;
  data: ClientProfileData;
  scope: SupportScope | null;
  onDraftAbout: () => void;
}) {
  const c = data.client;
  const clientId = c.id;
  const firstName = c.first_name?.trim() || data.name;
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClient);
  const noPhoto = useNoPhoto(orgId, clientId);
  const before: Basics = {
    date_of_birth: c.date_of_birth ?? "",
    insurance: c.insurance ?? "",
    admission_date: c.admission_date ?? "",
  };
  const [basics, setBasics] = useState<Basics>(before);
  const [wantsPhoto, setWantsPhoto] = useState<boolean | null>(
    scope?.no_photo ? false : c.client_photo_url ? true : null,
  );
  const set = (k: keyof Basics) => (v: string) => setBasics((b) => ({ ...b, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, string | null> = {};
      for (const k of Object.keys(basics) as (keyof Basics)[]) {
        if (basics[k].trim() !== before[k]) patch[k] = basics[k].trim() || null;
      }
      await updateFn({ data: { organizationId: orgId, clientId, patch } });
    },
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["client-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function answerPhoto(v: boolean) {
    setWantsPhoto(v);
    if (!v) noPhoto.mutate(true);
    else if (scope?.no_photo) noPhoto.mutate(false);
  }

  return (
    <div className="space-y-2" data-testid="client-setup-about">
      <div className="grid gap-3 sm:grid-cols-3">
        <LabeledInput label="Date of birth" type="date" value={basics.date_of_birth} onChange={set("date_of_birth")} />
        <LabeledInput label="Insurance" value={basics.insurance} onChange={set("insurance")} />
        <LabeledInput label="Start date" type="date" value={basics.admission_date} onChange={set("admission_date")} />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save date of birth, insurance and start date"}
        </Button>
      </div>
      <YesNo
        question="Add a photo?"
        value={wantsPhoto}
        onChange={answerPhoto}
        disabled={noPhoto.isPending}
        yesLabel="Upload photo"
        noLabel="Person prefers no photo"
        noNote="The photo won't show as missing, and the Client file's photo row is marked Not needed."
      >
        <ClientPhotoCard clientId={clientId} />
      </YesNo>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-sm text-muted-foreground">
          Nectar can draft “About {firstName}” from their PCSP. Nothing is saved until you approve it.
        </p>
        <Button variant="outline" onClick={onDraftAbout}>
          <Sparkles className="h-4 w-4" /> Draft About {firstName} from the PCSP
        </Button>
      </div>
    </div>
  );
}
