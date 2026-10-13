// When components/nectar/draft-jobs-driver.tsx loads and polls draft jobs.
// N2 deletes that driver (the requirements pipeline goes); delete this with it.

export const DRAFT_JOBS_POLL_MS = 5_000;

/** Only owners and agency-wide admins load draft jobs at all. */
export function draftJobsQueryEnabled(orgId: string | null | undefined, isAgencyAdmin: boolean): boolean {
  return !!orgId && isAgencyAdmin;
}

/** Poll every 5 s only while a job is still running; otherwise don't poll. */
export function draftJobsPollInterval(jobs: readonly unknown[] | null | undefined): number | false {
  return jobs && jobs.length > 0 ? DRAFT_JOBS_POLL_MS : false;
}
