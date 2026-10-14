// Medication training for Give meds: what med_training_status returns and
// what each person sees. Only approved, unexpired medication training counts.
// Pure; the server check is med-training.server.ts.

export type MedTrainingStatus = "approved" | "not_current" | "not_set_up";

export function asTrainingStatus(raw: unknown): MedTrainingStatus {
  return raw === "approved" || raw === "not_set_up" ? raw : "not_current";
}

/** Staff whose training isn't approved and current can't log a given dose. */
export function canGiveWithTraining(status: MedTrainingStatus): boolean {
  return status !== "not_current";
}

/** The note Give meds shows, or null when nothing needs saying. */
export function trainingNotice(
  status: MedTrainingStatus,
  isAdmin: boolean,
): { tone: "warn" | "danger"; text: string; href?: string } | null {
  if (status === "approved") return null;
  if (status === "not_set_up") {
    return isAdmin
      ? {
          tone: "warn",
          text: "Set up medication training in Evidence. Until then, no one's medication training is being checked.",
          href: "/dashboard/evidence",
        }
      : null;
  }
  return {
    tone: "danger",
    text: "Your medication training isn't approved or has expired, so you can't log a dose as given. You can still log a dose that wasn't given. Ask an admin.",
  };
}
