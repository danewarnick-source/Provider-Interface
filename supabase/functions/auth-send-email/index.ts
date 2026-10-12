// Supabase Auth "Send Email" hook. Supabase Auth calls this instead of its
// own built-in mailer for every auth email (signup OTP, password recovery,
// magic link, email change, native admin invite) — routing delivery through
// the same Resend rail every other HIVE email uses, instead of Supabase's
// shared mailer (which per Supabase's current policy only reliably delivers
// to accounts inside our own Supabase org, not real end users).
//
// This function is called BY Supabase Auth, not by our app, so it is
// authenticated with a Standard Webhooks signature (verify_jwt = false in
// config.toml) rather than a user JWT. Wiring it up requires a one-time
// manual step in the Supabase dashboard — see the comment at the bottom of
// this file.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Same mailbox as src/lib/managed-from.ts. Prefer RESEND_FROM / EMAIL_FROM;
 *  never fall back to Resend sandbox. */
const DEFAULT_MANAGED_FROM_ADDRESS = "noreply@providerinterface.com";
const DEFAULT_MANAGED_FROM_NAME = "Provider Interface";

function extractEmailAddress(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const angled = trimmed.match(/<([^>]+)>/);
  const candidate = (angled?.[1] ?? trimmed).trim();
  if (!candidate.includes("@") || candidate.includes(" ")) return undefined;
  if (candidate.toLowerCase().endsWith("@resend.dev")) return undefined;
  return candidate;
}

function managedFromAddress(): string {
  const raw = (Deno.env.get("RESEND_FROM") ?? Deno.env.get("EMAIL_FROM") ?? "").trim();
  return extractEmailAddress(raw) ?? DEFAULT_MANAGED_FROM_ADDRESS;
}

function managedFromHeader(): string {
  return `${DEFAULT_MANAGED_FROM_NAME} <${managedFromAddress()}>`;
}

type EmailActionType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "reauthentication";

type HookPayload = {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Denim email palette — exact mirror of DENIM / DENIM_FONTS in
 * src/lib/design-tokens.ts (edge functions can't import from src/).
 */
const DENIM = {
  deep: "#1B3350",
  pri: "#274C77",
  acc: "#4D9F3A",
  pt: "#EAF0F6",
  bg: "#F6F8FA",
  paper: "#FFFFFF",
  ink: "#17283D",
  text: "#3E4B5A",
  muted: "#5F6B78",
  line: "#E1E7EE",
  ondarkp: "#CBD8E6",
} as const;
const EMAIL_BODY_FONT = "Figtree, Arial, 'Segoe UI', sans-serif";
const EMAIL_HEADING_FONT = "Manrope, Arial, 'Segoe UI', sans-serif";

function wrap(inner: string): string {
  return `
    <div style="background:${DENIM.bg};padding:24px 12px;font-family:${EMAIL_BODY_FONT};color:${DENIM.text};font-size:15px;line-height:1.6">
    <div style="max-width:560px;margin:0 auto;background:${DENIM.paper};border:1px solid ${DENIM.line};border-radius:14px;overflow:hidden">
      <div style="background:${DENIM.deep};padding:18px 24px">
        <div style="font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${DENIM.ondarkp}">HIVE</div>
      </div>
      <div style="height:3px;background:${DENIM.acc}"></div>
      <div style="padding:24px">
      ${inner}
      </div>
    </div>
    </div>
  `;
}

function codeHtml(token: string): string {
  return `
          <p style="margin:28px 0;text-align:center">
            <span style="display:inline-block;font-family:${EMAIL_HEADING_FONT};font-size:32px;font-weight:700;letter-spacing:.2em;color:${DENIM.deep};background:${DENIM.pt};padding:16px 24px;border-radius:14px">
              ${escapeHtml(token)}
            </span>
          </p>`;
}

function buttonHtml(href: string, label: string): string {
  return `
    <p style="margin:28px 0">
      <a href="${href}"
         style="display:inline-block;background:${DENIM.pri};color:#FFFFFF;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600">
        ${escapeHtml(label)}
      </a>
    </p>
    <p style="color:${DENIM.muted};font-size:12px">If the button doesn't work, copy and paste this link into your browser:<br/>
      <span style="word-break:break-all;color:${DENIM.pri}">${href}</span>
    </p>
  `;
}

/** Mirrors PROVIDER_INTERFACE_ORIGIN in src/lib/auth-redirect.ts. */
const PUBLIC_EMAIL_ORIGIN = "https://providerinterface.com";

function isLovableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "lovable.app" ||
    host === "lovable.dev" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev")
  );
}

function defaultRedirectPath(type: EmailActionType): string {
  switch (type) {
    case "recovery":
      return "/reset-password";
    case "invite":
      return "/reset-password";
    case "magiclink":
      return "/login";
    case "email_change":
      return "/login";
    default:
      return "/";
  }
}

function isHivecertifyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "hivecertify.com" || host.endsWith(".hivecertify.com");
}

/** Same allowlist as isSafeAuthOrigin in src/lib/auth-redirect.ts. */
const ALLOWED_AUTH_ORIGINS = new Set([
  "https://providerinterface.com",
  "https://www.providerinterface.com",
  "https://agency-peace-of-mind.vercel.app",
]);

function isDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function isAllowedAuthOrigin(url: URL): boolean {
  if (isDevHost(url.hostname)) return url.protocol === "http:" || url.protocol === "https:";
  return ALLOWED_AUTH_ORIGINS.has(url.origin);
}

/** User-facing auth-email links. Anything off the allowlist, including Lovable and hivecertify.com, becomes providerinterface.com. */
function sanitizeRedirectTo(redirectTo: string, type: EmailActionType): string {
  const fallback = `${PUBLIC_EMAIL_ORIGIN}${defaultRedirectPath(type)}`;
  try {
    const url = new URL(redirectTo);
    if (isLovableHost(url.hostname) || isHivecertifyHost(url.hostname) || !isAllowedAuthOrigin(url)) {
      return `${PUBLIC_EMAIL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function verifyLink(supabaseUrl: string, data: HookPayload["email_data"]): string {
  const params = new URLSearchParams({
    token: data.token_hash,
    type: data.email_action_type,
    redirect_to: sanitizeRedirectTo(data.redirect_to, data.email_action_type),
  });
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/verify?${params.toString()}`;
}

function buildEmail(
  supabaseUrl: string,
  data: HookPayload["email_data"],
): { subject: string; html: string } {
  switch (data.email_action_type) {
    case "signup": {
      return {
        subject: "Verify your email for HIVE",
        html: wrap(`
          <p>Welcome to HIVE. Enter this code to verify your email and finish creating your account:</p>
          ${codeHtml(data.token)}
          <p style="color:${DENIM.muted};font-size:12px">This code expires shortly. If you didn't try to sign up, you can ignore this email.</p>
        `),
      };
    }
    case "recovery": {
      const link = verifyLink(supabaseUrl, data);
      return {
        subject: "Reset your HIVE password",
        html: wrap(`
          <p>We received a request to reset the password for this HIVE account.</p>
          ${buttonHtml(link, "Reset password")}
          <p style="color:${DENIM.muted};font-size:12px;margin-top:24px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        `),
      };
    }
    case "invite": {
      const link = verifyLink(supabaseUrl, data);
      return {
        subject: "You've been invited to HIVE",
        html: wrap(`
          <p>You've been invited to join HIVE.</p>
          ${buttonHtml(link, "Accept invitation")}
        `),
      };
    }
    case "email_change": {
      const link = verifyLink(supabaseUrl, data);
      return {
        subject: "Confirm your new email for HIVE",
        html: wrap(`
          <p>Confirm this address to finish updating the email on your HIVE account.</p>
          ${buttonHtml(link, "Confirm new email")}
          <p style="color:${DENIM.muted};font-size:12px;margin-top:24px">If you didn't request this change, you can safely ignore this email.</p>
        `),
      };
    }
    case "reauthentication": {
      return {
        subject: "Your HIVE confirmation code",
        html: wrap(`
          <p>Use this code to confirm the action you're taking on your HIVE account:</p>
          ${codeHtml(data.token)}
        `),
      };
    }
    default: {
      const link = verifyLink(supabaseUrl, data);
      return {
        subject: "Confirm your HIVE account action",
        html: wrap(`${buttonHtml(link, "Continue")}`),
      };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

  if (!hookSecret || !RESEND_API_KEY || !SUPABASE_URL) {
    console.error(
      "[auth-send-email] not configured: missing SEND_EMAIL_HOOK_SECRET, RESEND_API_KEY, or SUPABASE_URL",
    );
    return json({ error: "not configured" }, 500);
  }

  const rawBody = await req.text();

  let payload: HookPayload;
  try {
    const wh = new Webhook(hookSecret);
    payload = wh.verify(rawBody, Object.fromEntries(req.headers)) as HookPayload;
  } catch (err) {
    console.error("[auth-send-email] signature verification failed", err);
    return json({ error: "invalid signature" }, 401);
  }

  try {
    const { subject, html } = buildEmail(SUPABASE_URL, payload.email_data);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: managedFromHeader(),
        to: [payload.user.email],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[auth-send-email] Resend failure", resp.status, errText);
      return json({ error: "email send failed" }, 500);
    }

    return json({}, 200);
  } catch (e) {
    console.error("[auth-send-email] unhandled", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────────
// MANUAL DASHBOARD STEP (cannot be done from code):
//
// 1. Deploy this function (Lovable Cloud / Supabase CLI deploy picks it up
//    automatically from supabase/functions/auth-send-email).
// 2. Set two Edge Function secrets (Supabase Dashboard → Edge Functions →
//    Secrets, or `supabase secrets set`):
//      - RESEND_API_KEY          (already set for send-email — reuse the same key)
//      - SEND_EMAIL_HOOK_SECRET  (generated in step 3 below)
// 3. In the Supabase Dashboard: Authentication → Hooks → "Send Email Hook"
//    → Enable → choose this function (auth-send-email) as the target →
//    Supabase generates a signing secret starting with `v1,whsec_...` —
//    copy it into SEND_EMAIL_HOOK_SECRET from step 2.
// 4. Save. From that point on, Supabase Auth calls this function for every
//    auth email (signup codes, password reset, invite, email change)
//    instead of its own mailer.
// 5. Authentication → URL Configuration: add
//    https://providerinterface.com/** as an Additional Redirect URL.
//    Auth emails rewrite hivecertify.com and Lovable hosts to
//    https://providerinterface.com. Also keep
//    https://agency-peace-of-mind.vercel.app/** if preview resets
//    should still land there. This is an ops change in the Supabase
//    dashboard — not in this repo.
// ────────────────────────────────────────────────────────────────────────
