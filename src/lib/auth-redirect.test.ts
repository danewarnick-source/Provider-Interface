import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RESET_PASSWORD_PATH,
  VERCEL_PREVIEW_ORIGIN,
  authRedirectUrl,
  isLovableAuthHost,
  isSafeAuthOrigin,
  normalizeOrigin,
  emailLinkOrigin,
  passwordResetRedirectUrl,
  PROVIDER_INTERFACE_ORIGIN,
  resolveAuthOrigin,
  rewriteEmailRedirectUrl,
  sanitizeAuthRedirectUrl,
} from "./auth-redirect.ts";

describe("isLovableAuthHost", () => {
  it("flags lovable.app / lovable.dev and their subdomains", () => {
    assert.equal(isLovableAuthHost("agency-peace-of-mind.lovable.app"), true);
    assert.equal(isLovableAuthHost("id-preview-7c0aa2f3--4bb83c55.lovable.app"), true);
    assert.equal(isLovableAuthHost("lovable.dev"), true);
    assert.equal(isLovableAuthHost("preview.lovable.dev"), true);
    assert.equal(isLovableAuthHost("hivecertify.com"), false);
    assert.equal(isLovableAuthHost("agency-peace-of-mind.vercel.app"), false);
    assert.equal(isLovableAuthHost("localhost"), false);
  });
});

describe("normalizeOrigin / isSafeAuthOrigin", () => {
  it("strips paths and rejects Lovable hosts", () => {
    assert.equal(
      normalizeOrigin("https://hivecertify.com/reset-password"),
      "https://hivecertify.com",
    );
    assert.equal(
      normalizeOrigin("agency-peace-of-mind.vercel.app"),
      "https://agency-peace-of-mind.vercel.app",
    );
    assert.equal(isSafeAuthOrigin("https://providerinterface.com"), true);
    assert.equal(isSafeAuthOrigin("https://www.providerinterface.com"), true);
    assert.equal(isSafeAuthOrigin("https://hivecertify.com"), false);
    assert.equal(isSafeAuthOrigin("https://evil.example"), false);
    assert.equal(isSafeAuthOrigin("https://providerinterface.com.evil.example"), false);
    assert.equal(isSafeAuthOrigin("https://agency-peace-of-mind.vercel.app"), true);
    assert.equal(isSafeAuthOrigin("https://agency-peace-of-mind.vercel.app.evil.example"), false);
    assert.equal(isSafeAuthOrigin("http://localhost:5173"), true);
    assert.equal(isSafeAuthOrigin("http://127.0.0.1:3000"), true);
    assert.equal(isSafeAuthOrigin("https://agency-peace-of-mind.lovable.app"), false);
    assert.equal(isSafeAuthOrigin(""), false);
  });
});

describe("resolveAuthOrigin / authRedirectUrl", () => {
  it("keeps providerinterface.com and the Vercel preview host", () => {
    assert.equal(resolveAuthOrigin("https://providerinterface.com"), PROVIDER_INTERFACE_ORIGIN);
    assert.equal(resolveAuthOrigin("https://www.providerinterface.com"), "https://www.providerinterface.com");
    assert.equal(resolveAuthOrigin(VERCEL_PREVIEW_ORIGIN), VERCEL_PREVIEW_ORIGIN);
    assert.equal(
      passwordResetRedirectUrl("https://providerinterface.com"),
      `https://providerinterface.com${RESET_PASSWORD_PATH}`,
    );
    assert.equal(
      passwordResetRedirectUrl("https://agency-peace-of-mind.vercel.app"),
      "https://agency-peace-of-mind.vercel.app/reset-password",
    );
  });

  it("rewrites hivecertify, Lovable, and other hosts to providerinterface.com", () => {
    assert.equal(resolveAuthOrigin("https://hivecertify.com"), PROVIDER_INTERFACE_ORIGIN);
    assert.equal(resolveAuthOrigin("https://evil.example"), PROVIDER_INTERFACE_ORIGIN);
    assert.equal(
      resolveAuthOrigin("https://agency-peace-of-mind.lovable.app"),
      PROVIDER_INTERFACE_ORIGIN,
    );
    assert.equal(
      passwordResetRedirectUrl("https://id-preview.lovable.app"),
      "https://providerinterface.com/reset-password",
    );
    assert.equal(
      passwordResetRedirectUrl("https://evil.example"),
      "https://providerinterface.com/reset-password",
    );
  });

  it("never returns a Lovable origin when nothing safe is passed (SSR)", () => {
    const origin = resolveAuthOrigin("");
    assert.equal(isSafeAuthOrigin(origin), true);
    assert.equal(isLovableAuthHost(new URL(origin).hostname), false);
    assert.equal(resolveAuthOrigin(null), origin);
    assert.ok(authRedirectUrl("/signup", "").endsWith("/signup"));
    assert.doesNotMatch(authRedirectUrl("/signup", ""), /lovable\.(app|dev)/);
  });
});

describe("sanitizeAuthRedirectUrl", () => {
  it("rewrites unsafe reset links onto providerinterface.com and keeps the path", () => {
    assert.equal(
      sanitizeAuthRedirectUrl("https://agency-peace-of-mind.lovable.app/reset-password"),
      "https://providerinterface.com/reset-password",
    );
    assert.equal(
      sanitizeAuthRedirectUrl(
        "https://preview.lovable.dev/audit-portal/set-password?packageId=abc",
      ),
      "https://providerinterface.com/audit-portal/set-password?packageId=abc",
    );
    assert.equal(
      sanitizeAuthRedirectUrl("https://evil.example/reset-password"),
      "https://providerinterface.com/reset-password",
    );
    assert.equal(
      sanitizeAuthRedirectUrl("https://hivecertify.com/reset-password"),
      "https://providerinterface.com/reset-password",
    );
  });

  it("leaves the Vercel preview URL alone", () => {
    assert.equal(
      sanitizeAuthRedirectUrl("https://agency-peace-of-mind.vercel.app/reset-password"),
      "https://agency-peace-of-mind.vercel.app/reset-password",
    );
    assert.equal(
      sanitizeAuthRedirectUrl("http://localhost:5173/reset-password"),
      "http://localhost:5173/reset-password",
    );
  });
});

describe("email links use providerinterface.com", () => {
  it("rewrites hivecertify.com and leaves other hosts", () => {
    assert.equal(emailLinkOrigin("https://hivecertify.com"), PROVIDER_INTERFACE_ORIGIN);
    assert.equal(emailLinkOrigin("https://app.hivecertify.com"), PROVIDER_INTERFACE_ORIGIN);
    assert.equal(emailLinkOrigin(VERCEL_PREVIEW_ORIGIN), VERCEL_PREVIEW_ORIGIN);
    assert.equal(
      rewriteEmailRedirectUrl("https://hivecertify.com/reset-password?x=1", "/reset-password"),
      "https://providerinterface.com/reset-password?x=1",
    );
    assert.equal(
      rewriteEmailRedirectUrl("https://preview.lovable.app/login", "/login"),
      "https://providerinterface.com/login",
    );
    assert.equal(
      rewriteEmailRedirectUrl("not a url", "/reset-password"),
      "https://providerinterface.com/reset-password",
    );
    assert.equal(
      rewriteEmailRedirectUrl("https://evil.example/reset-password", "/reset-password"),
      "https://providerinterface.com/reset-password",
    );
  });
});

describe("auth email call sites do not hardcode Lovable", () => {
  it("forgot-password uses passwordResetRedirectUrl", () => {
    const src = readFileSync(new URL("../routes/forgot-password.tsx", import.meta.url), "utf8");
    assert.match(src, /passwordResetRedirectUrl/);
    assert.match(src, /resetPasswordForEmail/);
    assert.doesNotMatch(src, /lovable\.(app|dev)/);
  });

  it("signup / auditor / hive-exec invite use the shared helper", () => {
    const signup = readFileSync(new URL("../routes/signup.tsx", import.meta.url), "utf8");
    const auditor = readFileSync(new URL("../routes/auditor.tsx", import.meta.url), "utf8");
    const hiveExec = readFileSync(
      new URL("./hive-exec-admin.functions.ts", import.meta.url),
      "utf8",
    );
    assert.match(signup, /authRedirectUrl\("\/signup"\)/);
    assert.match(auditor, /authRedirectUrl\("\/auditor"\)/);
    assert.match(hiveExec, /passwordResetRedirectUrl/);
    assert.match(hiveExec, /inviteUserByEmail/);
  });

  it("auth-send-email rewrites Lovable redirect_to before building the link", () => {
    const src = readFileSync(
      new URL("../../supabase/functions/auth-send-email/index.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /sanitizeRedirectTo/);
    assert.match(src, /providerinterface\.com/);
    assert.match(src, /hivecertify\.com/);
    assert.match(src, /lovable\.app/);
    assert.match(src, /redirect_to: sanitizeRedirectTo/);
  });
});
