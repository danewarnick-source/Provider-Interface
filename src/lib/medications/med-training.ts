// Medication training for Give meds. The decision is made once, on the
// server: med_training_status (its med_training_decision) returns current,
// expired, unapproved or not_set_up from the training records. Training never
// blocks a dose. log_medication_dose saves a dose given without current
// training with a mark (given_without_current_training, training_issue) and
// notifies admins. Pure: what each status and mark says.

export type MedTrainingStatus = "current" | "expired" | "unapproved" | "not_set_up";
export type TrainingIssue = Exclude<MedTrainingStatus, "current">;

/** The fixed text on a dose given without current med training. */
export const UNTRAINED_DOSE_MARK = "Given by staff without current med training";

const STATUSES: readonly MedTrainingStatus[] = ["current", "expired", "unapproved", "not_set_up"];

/** What the server returned; anything unknown is treated as unapproved. */
export function asTrainingStatus(raw: unknown): MedTrainingStatus {
  return STATUSES.includes(raw as MedTrainingStatus) ? (raw as MedTrainingStatus) : "unapproved";
}

const ISSUE_LABEL: Record<TrainingIssue, string> = {
  expired: "training expired",
  unapproved: "training not approved",
  not_set_up: "no med training set up",
};

/** "training expired", "training not approved", "no med training set up", or "". */
export function trainingIssueLabel(issue: string | null | undefined): string {
  return ISSUE_LABEL[issue as TrainingIssue] ?? "";
}

/** "Given by staff without current med training (training expired)", or null for an unmarked dose. */
export function doseTrainingMark(d: {
  given_without_current_training?: boolean | null;
  training_issue?: string | null;
}): string | null {
  if (!d.given_without_current_training) return null;
  const why = trainingIssueLabel(d.training_issue);
  return why ? `${UNTRAINED_DOSE_MARK} (${why})` : UNTRAINED_DOSE_MARK;
}

const MARKED = "You can still log doses. Each one is marked and admins are told.";

/** The note Give meds shows, or null when nothing needs saying. */
export function trainingNotice(
  status: MedTrainingStatus,
  isAdmin: boolean,
): { tone: "warn"; text: string; href?: string } | null {
  if (status === "current") return null;
  if (status === "not_set_up") {
    return isAdmin
      ? {
          tone: "warn",
          text: "Med training isn't set up. Until you set it up in Evidence, every dose given is marked and admins are told.",
          href: "/dashboard/evidence",
        }
      : { tone: "warn", text: `Med training isn't set up for your agency. ${MARKED}` };
  }
  return {
    tone: "warn",
    text:
      status === "expired"
        ? `Your med training has expired. ${MARKED}`
        : `Your med training isn't approved. ${MARKED}`,
  };
}
