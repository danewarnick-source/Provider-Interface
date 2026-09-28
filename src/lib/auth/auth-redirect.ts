/**
 * Where auth emails (password reset, invite, magic link, email confirm)
 * send people after they click the link.
 *
 * Only these origins are accepted. Anything else, including hivecertify.com
 * and Lovable preview hosts, is rewritten to https://providerinterface.com.
 *   https://providerinterface.com
 *   https://www.providerinterface.com
 *   https://agency-peace-of-mind.vercel.app
 *   http(s)://localhost and http(s)://127.0.0.1 (any port, for dev)
 *
 * Ops (cannot be done from this repo): in the Supabase dashboard,
 * Authentication → URL Configuration, set Site URL to
 * https://providerinterface.com and keep Additional Redirect URLs to
 * that host (and www) plus https://agency-peace-of-mind.vercel.app.
 */

export const CANONICAL_SITE_ORIGIN = "https://hivecertify.com";
/** Public site for links people click in email. Not the auth-redirect host. */
export const PROVIDER_INTERFACE_ORIGIN = "https://providerinterface.com";
export const RESET_PASSWORD_PATH = "/reset-password";
export const VERCEL_PREVIEW_ORIGIN = "https://agency-peace-of-mind.vercel.app";

function readEnv(name: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) {
      const value = process.env[name];
      return typeof value === "string" && value.trim() ? value : undefined;
    }
  } catch {
    /* browser / edge without process */
  }
  return undefined;
}

export function isHivecertifyHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  return host === "hivecertify.com" || host.endsWith(".hivecertify.com");
}

export function isLovableAuthHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "lovable.app" ||
    host === "lovable.dev" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev")
  );
}

export function normalizeOrigin(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

const ALLOWED_AUTH_ORIGINS = new Set([
  PROVIDER_INTERFACE_ORIGIN,
  "https://www.providerinterface.com",
  VERCEL_PREVIEW_ORIGIN,
]);

function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

/** Exact app origins only. Any other host is an open redirect. */
export function isSafeAuthOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    if (url.username || url.password) return false;
    if (isLocalDevHost(url.hostname)) {
      return url.protocol === "http:" || url.protocol === "https:";
    }
    return ALLOWED_AUTH_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function envAuthOrigin(): string | null {
  const candidates = [
    readEnv("PUBLIC_SITE_URL"),
    readEnv("PUBLIC_APP_URL"),
    readEnv("SITE_URL"),
    readEnv("APP_URL"),
    readEnv("APP_ORIGIN"),
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin && isSafeAuthOrigin(origin)) return origin;
  }

  const vercel = readEnv("VERCEL_PROJECT_PRODUCTION_URL") || readEnv("VERCEL_URL");
  const vercelOrigin = normalizeOrigin(vercel);
  if (vercelOrigin && isSafeAuthOrigin(vercelOrigin)) return vercelOrigin;

  return null;
}

/**
 * Resolve the origin auth emails should use.
 * `candidate` wins when it is a real, non-Lovable origin (callers pass
 * window.location.origin or a site_origin field from the browser).
 */
export function resolveAuthOrigin(candidate?: string | null): string {
  const fromCandidate = normalizeOrigin(candidate);
  if (fromCandidate && isSafeAuthOrigin(fromCandidate)) return fromCandidate;

  if (typeof window !== "undefined") {
    try {
      const fromWindow = normalizeOrigin(window.location.origin);
      if (fromWindow && isSafeAuthOrigin(fromWindow)) return fromWindow;
    } catch {
      /* ignore */
    }
  }

  return envAuthOrigin() ?? PROVIDER_INTERFACE_ORIGIN;
}

export function authRedirectUrl(path: string, candidate?: string | null): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${resolveAuthOrigin(candidate)}${p}`;
}

export function passwordResetRedirectUrl(candidate?: string | null): string {
  return authRedirectUrl(RESET_PASSWORD_PATH, candidate);
}

/**
 * Origin printed in email links. Unsafe hosts, including hivecertify.com,
 * become providerinterface.com.
 */
export function emailLinkOrigin(candidate?: string | null): string {
  return resolveAuthOrigin(candidate);
}

/** Full redirect URL embedded in an auth email. Unsafe hosts become providerinterface.com. */
export function rewriteEmailRedirectUrl(url: string, fallbackPath: string = "/"): string {
  const path = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
  const fallback = `${PROVIDER_INTERFACE_ORIGIN}${path}`;
  try {
    const parsed = new URL(url);
    if (!isSafeAuthOrigin(parsed.origin)) {
      return `${PROVIDER_INTERFACE_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Rewrite a full redirect URL when its origin is not on the allowlist.
 * Keeps path, query, and hash so /reset-password still lands on the right page.
 */
export function sanitizeAuthRedirectUrl(
  url: string,
  fallbackPath: string = RESET_PASSWORD_PATH,
): string {
  const path = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
  const fallback = `${PROVIDER_INTERFACE_ORIGIN}${path}`;
  try {
    const parsed = new URL(url);
    if (!isSafeAuthOrigin(parsed.origin)) {
      return `${PROVIDER_INTERFACE_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
