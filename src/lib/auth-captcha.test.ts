import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authCaptchaSiteKey, captchaTokenOption } from "./auth-captcha.ts";

describe("auth captcha", () => {
  it("is a no-op until the Turnstile site key is set", () => {
    assert.equal(authCaptchaSiteKey({}), "");
    assert.equal(authCaptchaSiteKey({ VITE_TURNSTILE_SITE_KEY: "  " }), "");
    assert.equal(captchaTokenOption(null), undefined);
    assert.equal(captchaTokenOption(""), undefined);
  });

  it("sends a captcha token only when one was issued", () => {
    assert.equal(authCaptchaSiteKey({ VITE_TURNSTILE_SITE_KEY: " site-key " }), "site-key");
    assert.deepEqual(captchaTokenOption(" token "), { captchaToken: "token" });
  });
});
