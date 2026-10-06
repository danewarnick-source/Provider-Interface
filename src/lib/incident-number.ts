/**
 * Org-wide incident report numbers. Callers must pass every number in the
 * organization for the year (service role), not the subset one filer can see.
 */

export function nextIncidentReportNumber(existing: readonly string[], year: number): string {
  const prefix = `IR-${year}-`;
  let max = 0;
  for (const raw of existing) {
    if (!raw.startsWith(prefix)) continue;
    const seq = Number.parseInt(raw.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function isUniqueConflict(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /duplicate key value|unique constraint/i.test(error.message ?? "");
}

/**
 * Insert with max+1. On a unique conflict, re-read and try the next number.
 * Other errors throw immediately.
 */
export async function insertIncidentNumbered<T>(opts: {
  year: number;
  listNumbers: () => Promise<readonly string[]>;
  insert: (
    reportNumber: string,
  ) => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>;
  maxAttempts?: number;
}): Promise<T> {
  const attempts = opts.maxAttempts ?? 5;
  let lastMessage = "Could not assign an incident number.";
  for (let i = 0; i < attempts; i++) {
    const reportNumber = nextIncidentReportNumber(await opts.listNumbers(), opts.year);
    const { data, error } = await opts.insert(reportNumber);
    if (!error && data) return data;
    lastMessage = error?.message || lastMessage;
    if (!isUniqueConflict(error)) throw new Error(lastMessage);
  }
  throw new Error(lastMessage);
}
