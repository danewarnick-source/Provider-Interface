import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PAID_SUBSCRIPTION_NEEDS_SERVICE_ROLE,
  SIGNUP_CHECKOUT_CONFIRM_MESSAGE,
  SIGNUP_CHECKOUT_START_MESSAGE,
  SIGNUP_EMAIL_CONFIRM_DENIED_MESSAGE,
  humanizeCheckoutConfirmError,
  humanizeCheckoutStartError,
  signupAuthCallbackError,
} from "./signup-checkout-error.ts";

describe("humanizeCheckoutStartError", () => {
  it("maps Missing Supabase environment variable(s) to a real sentence, not {}", () => {
    assert.equal(
      humanizeCheckoutStartError(
        new Error(
          "Missing Supabase environment variable(s): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Connect Supabase in Lovable Cloud.",
        ),
      ),
      SIGNUP_CHECKOUT_START_MESSAGE,
    );
    assert.doesNotMatch(humanizeCheckoutStartError({}), /^\{\}$/);
    assert.equal(humanizeCheckoutStartError({}), SIGNUP_CHECKOUT_START_MESSAGE);
  });

  it("does not invent a SERVICE_ROLE name in the toast", () => {
    const text = humanizeCheckoutStartError(
      new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"),
    );
    assert.doesNotMatch(text, /SERVICE_ROLE/);
    assert.equal(text, SIGNUP_CHECKOUT_START_MESSAGE);
  });

  it("keeps a signed-out sentence", () => {
    assert.equal(
      humanizeCheckoutStartError(new Error("Not signed in.")),
      "Session lost — please sign in again.",
    );
  });
});

describe("humanizeCheckoutConfirmError", () => {
  it("names SUPABASE_SERVICE_ROLE_KEY when the paid write cannot run", () => {
    assert.match(
      humanizeCheckoutConfirmError(
        new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY"),
      ),
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    assert.equal(
      humanizeCheckoutConfirmError(new Error(PAID_SUBSCRIPTION_NEEDS_SERVICE_ROLE)),
      PAID_SUBSCRIPTION_NEEDS_SERVICE_ROLE,
    );
    assert.equal(
      humanizeCheckoutConfirmError(new Error("new row violates row-level security policy")),
      SIGNUP_CHECKOUT_CONFIRM_MESSAGE,
    );
    assert.doesNotMatch(humanizeCheckoutConfirmError({}), /^\{\}$/);
  });
});

describe("signupAuthCallbackError", () => {
  it("reads access_denied / otp hash without treating a session hash as denied", () => {
    assert.equal(
      signupAuthCallbackError("", "#error=access_denied&error_code=otp_expired"),
      SIGNUP_EMAIL_CONFIRM_DENIED_MESSAGE,
    );
    assert.equal(
      signupAuthCallbackError("?error=access_denied", ""),
      SIGNUP_EMAIL_CONFIRM_DENIED_MESSAGE,
    );
    assert.equal(signupAuthCallbackError("", "#access_token=abc&refresh_token=def"), null);
  });
});

describe("Payment and lock paths use VITE_ session env", () => {
  it("createSubscriptionCheckoutFn writes org_subscriptions with the service role after the owner check", () => {
    const checkout = readFileSync(new URL("../financial/stripe-checkout.functions.ts", import.meta.url), "utf8");
    const pausedStart = checkout.indexOf("async function ensurePausedSubscription");
    const exemptStart = checkout.indexOf("async function activateExemptOrg");
    const handlerStart = checkout.indexOf("export const createSubscriptionCheckoutFn");
    const handlerEnd = checkout.indexOf("export const createPortalSessionFn");
    assert.ok(pausedStart >= 0 && exemptStart > pausedStart && handlerStart > exemptStart && handlerEnd > handlerStart);
    const paused = checkout.slice(pausedStart, exemptStart);
    const exempt = checkout.slice(exemptStart, checkout.indexOf("/** Public — signup payment step"));
    const handler = checkout.slice(handlerStart, handlerEnd);

    assert.match(handler, /requireOrgAdmin\(db, context\.userId, data\.organizationId\)/);
    assert.match(handler, /billingDb\(context\.supabase\)/);
    assert.match(handler, /humanizeCheckoutStartError/);
    assert.match(handler, /subscriptionAdmin\(\)/);

    for (const block of [paused, exempt]) {
      assert.match(block, /subscriptionAdmin\(\)/);
      assert.doesNotMatch(block, /billingDb\(/);
      assert.doesNotMatch(block, /console\.warn/);
      assert.match(block, /\.eq\("organization_id", orgId\)/);
      assert.match(block, /throw new Error/);
    }

    assert.doesNotMatch(handler, /(?:\bdb|billingDb\([^)]*\))\s*\.from\("org_subscriptions"\)/);
    assert.equal(handler.match(/subs\s*\.from\("org_subscriptions"\)/g)?.length, 3);
    assert.match(
      handler,
      /\.update\(\{ stripe_customer_id: customerId \}\)\s*\.eq\("organization_id", data\.organizationId\)/,
    );
    assert.match(handler, /if \(custErr\) throw new Error\(custErr\.message\)/);
    assert.doesNotMatch(handler, /console\.warn/);
  });

  it("signup Payment toasts the humanized checkout sentence", () => {
    const page = readFileSync(new URL("../../routes/signup.tsx", import.meta.url), "utf8");
    assert.match(page, /humanizeCheckoutStartError/);
    assert.match(page, /signupAuthCallbackError/);
    assert.doesNotMatch(page, /toast\.error\(\(e as Error\)\.message\)/);
  });

  it("getBillingLockFn reads the session first and does not require service role", () => {
    const lock = readFileSync(new URL("../billing/billing-lock.functions.ts", import.meta.url), "utf8");
    assert.match(lock, /readSupabaseAdminEnv/);
    assert.match(lock, /readLockSub\(context\.supabase/);
    assert.match(lock, /VITE_SUPABASE_URL/);
    assert.doesNotMatch(lock, /throw new Error\("Missing Supabase environment variable/);
  });
});
