// A6-pre: shared email send rail via Resend REST API.
//
// SECURITY:
// - verify_jwt = true (see supabase/config.toml) rejects unsigned tokens.
//   The anon key and user access tokens are still valid project JWTs, so
//   this handler accepts only the service-role bearer. Server functions
//   invoke it with supabaseAdmin after their own permission checks.
// - `from` is pinned to the Hive mailbox (RESEND_FROM / EMAIL_FROM /
//   noreply@providerinterface.com). A caller display name is kept.
// - No HTML in error responses. Logs do not include addresses or bodies.

import {
  bearerIsServiceRole,
  hiveMailboxFromEnv,
  pinHiveFrom,
} from "../_shared/service-role-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SendBody = {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!bearerIsServiceRole(authHeader, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
      return json({ error: "Unauthorized" }, 401);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const body = (await req.json().catch(() => null)) as SendBody | null;
    if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

    const { to, subject, html, text, reply_to, cc, bcc } = body;
    if (!to || (typeof to !== "string" && !Array.isArray(to)))
      return json({ error: "Missing 'to'" }, 400);
    if (typeof subject !== "string" || !subject.trim())
      return json({ error: "Missing 'subject'" }, 400);
    if (!html && !text) return json({ error: "Missing 'html' or 'text'" }, 400);

    const from = pinHiveFrom(
      body.from,
      hiveMailboxFromEnv(Deno.env.get("RESEND_FROM"), Deno.env.get("EMAIL_FROM")),
    );

    const payload: Record<string, unknown> = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
    };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (reply_to) payload.reply_to = reply_to;
    if (cc) payload.cc = cc;
    if (bcc) payload.bcc = bcc;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const respText = await resp.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(respText);
    } catch {
      parsed = { raw: respText };
    }

    if (!resp.ok) {
      const errMsg =
        parsed && typeof parsed === "object" && "message" in (parsed as Record<string, unknown>)
          ? String((parsed as Record<string, unknown>).message)
          : `Resend error ${resp.status}`;
      console.error("[send-email] Resend failure", resp.status);
      return json({ ok: false, error: errMsg, status: resp.status }, 502);
    }

    const id =
      parsed && typeof parsed === "object" && "id" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).id)
        : null;

    return json({ ok: true, id });
  } catch (_e) {
    console.error("[send-email] unhandled");
    return json({ ok: false, error: "Email send failed" }, 500);
  }
});
