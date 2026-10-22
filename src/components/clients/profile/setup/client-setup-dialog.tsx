// "Finish setting up <first name>": About → Contacts → Health → Team →
// Behavior → Client file, then a summary. Every step is optional and saves as
// it goes; closing early ("Later") keeps the banner, which reopens the steps.
// "Finish setup" ends it (client_support_scope.setup_finished_at).

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SETUP_STEP,
  SETUP_STEPS,
  nextSetupStep,
  previousSetupStep,
  setupBannerText,
  stepCounter,
  type SetupStep,
  type StepOutcome,
} from "@/lib/clients/client-setup";
import type { ClientOverview } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { SetupSummary } from "./setup-summary";
import { StepAbout } from "./step-about";
import { StepHealth } from "./step-health";
import { StepBehavior, StepContacts, StepFile, StepTeam } from "./setup-steps";
import { useSaveSupportScope, useSupportScope } from "./use-support-scope";

type Screen = SetupStep | "summary";

export function ClientSetupDialog({
  open,
  orgId,
  data,
  overview,
  onClose,
  onOpenSection,
  onDraftAbout,
}: {
  open: boolean;
  orgId: string;
  data: ClientProfileData;
  overview: ClientOverview | null;
  onClose: () => void;
  onOpenSection: (section: ClientProfileSection) => void;
  onDraftAbout: () => void;
}) {
  const clientId = data.client.id;
  const firstName = data.client.first_name?.trim() || data.name;
  const scope = useSupportScope(clientId).data ?? null;
  const finish = useSaveSupportScope(orgId, clientId);
  const [screen, setScreen] = useState<Screen>(SETUP_STEPS[0]);
  const [outcomes, setOutcomes] = useState<Partial<Record<SetupStep, StepOutcome>>>({});

  useEffect(() => {
    if (open) setScreen(SETUP_STEPS[0]);
  }, [open]);

  const leave = (step: SetupStep, outcome: StepOutcome) => {
    setOutcomes((o) => ({ ...o, [step]: outcome }));
    setScreen(nextSetupStep(step) ?? "summary");
  };
  const openSection = (section: ClientProfileSection) => {
    onClose();
    onOpenSection(section);
  };

  const body = (step: SetupStep) => {
    switch (step) {
      case "about":
        return <StepAbout orgId={orgId} data={data} scope={scope} onDraftAbout={onDraftAbout} />;
      case "contacts":
        return <StepContacts orgId={orgId} data={data} />;
      case "health":
        return <StepHealth orgId={orgId} clientId={clientId} scope={scope} />;
      case "team":
        return <StepTeam orgId={orgId} data={data} overview={overview} />;
      case "behavior":
        return <StepBehavior orgId={orgId} data={data} scope={scope} />;
      case "file":
        return <StepFile orgId={orgId} data={data} onSaved={() => leave("file", "done")} />;
    }
  };

  const step = screen === "summary" ? null : screen;
  const back = step ? previousSetupStep(step) : SETUP_STEPS[SETUP_STEPS.length - 1];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="client-setup-dialog">
        <DialogHeader>
          <DialogTitle>{setupBannerText(firstName).title}</DialogTitle>
          <DialogDescription>
            {step
              ? `${stepCounter(step)}: ${SETUP_STEP[step].label}. Skip anything; it saves as you go.`
              : "Here's what's set up. Anything skipped can be added later."}
          </DialogDescription>
        </DialogHeader>
        {step ? (
          body(step)
        ) : (
          <SetupSummary outcomes={outcomes} onOpenSection={openSection} />
        )}
        <DialogFooter className="gap-2 max-md:[&_button]:min-h-11">
          {back ? (
            <Button variant="ghost" className="sm:mr-auto" onClick={() => setScreen(back)}>
              Back
            </Button>
          ) : null}
          {step ? (
            <>
              <Button variant="outline" onClick={() => leave(step, "skipped")}>
                Skip {SETUP_STEP[step].label.toLowerCase()}
              </Button>
              <Button onClick={() => leave(step, "done")}>
                {nextSetupStep(step) ? `Next: ${SETUP_STEP[nextSetupStep(step)!].label}` : "See summary"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Later
              </Button>
              <Button
                disabled={finish.isPending}
                onClick={() => finish.mutate({ answers: {}, finished: true }, { onSuccess: onClose })}
                data-testid="client-setup-finish"
              >
                {finish.isPending ? "Saving…" : "Finish setup"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
