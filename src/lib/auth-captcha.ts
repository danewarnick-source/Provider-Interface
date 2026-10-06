/** Cloudflare Turnstile site key. Empty means captcha is off (no token sent). */
export const AUTH_CAPTCHA_REQUIRED = "Complete the verification check before continuing.";

export function authCaptchaSiteKey(
  env: { VITE_TURNSTILE_SITE_KEY?: string } | undefined = import.meta.env,
): string {
  return String(env?.VITE_TURNSTILE_SITE_KEY ?? "").trim();
}

export function captchaTokenOption(
  token: string | null | undefined,
): { captchaToken: string } | undefined {
  const value = String(token ?? "").trim();
  return value ? { captchaToken: value } : undefined;
}
