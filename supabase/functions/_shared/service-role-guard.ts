/**
 * Shared checks for edge functions that must only run for server-side callers.
 * The public anon key and user access tokens are also valid project JWTs, so
 * verify_jwt alone does not keep them out.
 */

export const DEFAULT_HIVE_FROM_ADDRESS = "noreply@providerinterface.com";
const DEFAULT_HIVE_FROM_NAME = "Provider Interface";

/** True only when the header is exactly `Bearer <service role key>`. */
export function bearerIsServiceRole(
  authorization: string | null | undefined,
  serviceRoleKey: string | null | undefined,
): boolean {
  const key = (serviceRoleKey ?? "").trim();
  const actual = (authorization ?? "").trim();
  if (!key || !actual) return false;
  const expected = `Bearer ${key}`;
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Mailbox only. RESEND_FROM wins, then EMAIL_FROM. Sandbox addresses are ignored. */
export function hiveMailboxFromEnv(resendFrom?: string | null, emailFrom?: string | null): string {
  const raw = (resendFrom ?? "").trim() || (emailFrom ?? "").trim();
  if (!raw) return DEFAULT_HIVE_FROM_ADDRESS;
  const angled = raw.match(/<([^<>]+)>/);
  const candidate = (angled?.[1] ?? raw).trim();
  if (
    !candidate.includes("@") ||
    /\s/.test(candidate) ||
    candidate.toLowerCase().endsWith("@resend.dev")
  ) {
    return DEFAULT_HIVE_FROM_ADDRESS;
  }
  return candidate;
}

/**
 * Keep a caller's display name, force the mailbox to the Hive sender.
 * Newlines and quotes are stripped so a name cannot break the header.
 */
export function pinHiveFrom(callerFrom: unknown, mailbox: string): string {
  const raw = typeof callerFrom === "string" ? callerFrom : "";
  const namePart = raw.match(/^\s*([^<]*?)\s*</)?.[1] ?? "";
  const name = namePart
    .replace(/[\r\n"]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200);
  return `${name || DEFAULT_HIVE_FROM_NAME} <${mailbox}>`;
}
