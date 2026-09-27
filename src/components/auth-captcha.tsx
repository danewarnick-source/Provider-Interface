import { useEffect, useRef } from "react";
import { authCaptchaSiteKey } from "@/lib/auth-captcha";

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: { sitekey: string }) => string;
  getResponse: (widgetId?: string) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

function turnstileApi(): TurnstileApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { turnstile?: TurnstileApi }).turnstile ?? null;
}

function loadTurnstile(): Promise<TurnstileApi> {
  const ready = turnstileApi();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    const finish = () => {
      const api = turnstileApi();
      if (api) resolve(api);
      else reject(new Error("captcha"));
    };
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = finish;
      script.onerror = () => reject(new Error("captcha"));
      document.head.appendChild(script);
      return;
    }
    script.addEventListener("load", finish, { once: true });
  });
}

/** True only when a site key is set and the widget has not issued a token yet. */
export function authCaptchaBlocked(): boolean {
  return Boolean(authCaptchaSiteKey()) && !readAuthCaptchaToken();
}

/** null when the site key is unset. Otherwise the current widget token, or null if it is not ready. */
export function readAuthCaptchaToken(): string | null {
  if (!authCaptchaSiteKey() || typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-turnstile-widget]");
  const widgetId = el?.getAttribute("data-turnstile-widget") ?? undefined;
  const token = turnstileApi()?.getResponse(widgetId)?.trim() ?? "";
  return token || null;
}

export function resetAuthCaptcha(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>("[data-turnstile-widget]");
  const widgetId = el?.getAttribute("data-turnstile-widget") ?? undefined;
  if (!widgetId) return;
  turnstileApi()?.reset(widgetId);
}

/**
 * Renders nothing until VITE_TURNSTILE_SITE_KEY is set.
 * Supabase Auth ignores captcha until the dashboard provider is turned on.
 */
export function AuthCaptcha() {
  const siteKey = authCaptchaSiteKey();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!siteKey || !host) return;
    let cancelled = false;
    let widgetId = "";
    void loadTurnstile()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        widgetId = api.render(hostRef.current, { sitekey: siteKey });
        hostRef.current.setAttribute("data-turnstile-widget", widgetId);
      })
      .catch(() => {
        /* widget stays empty; submit asks the person to complete the check */
      });
    return () => {
      cancelled = true;
      const api = turnstileApi();
      if (widgetId && api) api.remove(widgetId);
      host.removeAttribute("data-turnstile-widget");
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={hostRef} className="min-h-16" data-testid="auth-captcha" />;
}
