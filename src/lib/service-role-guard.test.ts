import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DEFAULT_HIVE_FROM_ADDRESS,
  bearerIsServiceRole,
  hiveMailboxFromEnv,
  pinHiveFrom,
} from "../../supabase/functions/_shared/service-role-guard.ts";

const KEY = "service-role-test-key";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("bearerIsServiceRole", () => {
  it("accepts only the exact service-role bearer", () => {
    assert.equal(bearerIsServiceRole(`Bearer ${KEY}`, KEY), true);
  });

  it("rejects the anon key, a user token, and a mismatched bearer", () => {
    assert.equal(bearerIsServiceRole("Bearer anon-key", KEY), false);
    assert.equal(bearerIsServiceRole("Bearer eyJhbGciOiJIUzI1NiJ9.user", KEY), false);
    assert.equal(bearerIsServiceRole(`bearer ${KEY}`, KEY), false);
    assert.equal(bearerIsServiceRole(null, KEY), false);
    assert.equal(bearerIsServiceRole(`Bearer ${KEY}`, ""), false);
  });

  it("trims a service-role key that picked up surrounding whitespace", () => {
    assert.equal(bearerIsServiceRole(`Bearer ${KEY}`, ` ${KEY}\n`), true);
  });
});

describe("hiveMailboxFromEnv", () => {
  it("prefers RESEND_FROM and ignores the Resend sandbox", () => {
    assert.equal(
      hiveMailboxFromEnv("alerts@providerinterface.com", "other@example.com"),
      "alerts@providerinterface.com",
    );
    assert.equal(hiveMailboxFromEnv("onboarding@resend.dev", null), DEFAULT_HIVE_FROM_ADDRESS);
    assert.equal(
      hiveMailboxFromEnv(null, "Provider Interface <ops@providerinterface.com>"),
      "ops@providerinterface.com",
    );
    assert.equal(hiveMailboxFromEnv(null, null), DEFAULT_HIVE_FROM_ADDRESS);
  });
});

describe("pinHiveFrom", () => {
  it("forces the Hive mailbox and keeps the display name", () => {
    assert.equal(
      pinHiveFrom("True North Supports <attacker@evil.test>", DEFAULT_HIVE_FROM_ADDRESS),
      "True North Supports <noreply@providerinterface.com>",
    );
    assert.equal(
      pinHiveFrom(
        "Provider Interface Audit <noreply@providerinterface.com>",
        "ops@providerinterface.com",
      ),
      "Provider Interface Audit <ops@providerinterface.com>",
    );
  });

  it("strips header breaks from the display name", () => {
    assert.equal(
      pinHiveFrom(
        "Evil\r\nBcc: x@y.test <noreply@providerinterface.com>",
        DEFAULT_HIVE_FROM_ADDRESS,
      ),
      "Evil Bcc: x@y.test <noreply@providerinterface.com>",
    );
  });

  it("uses the default name when from is missing", () => {
    assert.equal(
      pinHiveFrom(undefined, "ops@providerinterface.com"),
      "Provider Interface <ops@providerinterface.com>",
    );
  });
});

describe("B1 edge callers", () => {
  it("send-email callers invoke with the service-role client", () => {
    for (const file of [
      "../../src/lib/email.functions.ts",
      "../../src/lib/invitations.functions.ts",
      "../../src/lib/threads.functions.ts",
      "../../src/lib/audit/audit-portal.functions.ts",
      "../../src/lib/billing-notifications.server.ts",
      "../../src/lib/training/training-only-exec.functions.ts",
    ]) {
      const src = read(file);
      assert.match(src, /functions\.invoke\(\s*"send-email"/);
      assert.match(src, /supabaseAdmin|admin\.functions\.invoke/);
    }
    assert.doesNotMatch(
      read("../../src/lib/email.functions.ts"),
      /\(supabase as any\)\.functions\.invoke/,
    );
    assert.doesNotMatch(
      read("../../src/lib/invitations.functions.ts"),
      /supabase\.functions\.invoke\("send-email"/,
    );
  });

  it("referral parse and date detection are not open service-role reads", () => {
    assert.match(
      read("../../supabase/functions/parse-referral-doc/index.ts"),
      /bearerIsServiceRole/,
    );
    assert.match(read("../../supabase/functions/detect-doc-dates/index.ts"), /bearerIsServiceRole/);
    assert.match(read("../../supabase/functions/send-email/index.ts"), /pinHiveFrom/);
    assert.doesNotMatch(
      read("../../supabase/functions/detect-doc-dates/index.ts"),
      /auth\.getUser/,
    );

    const detectCaller = read("../../src/lib/document-effective-dating.functions.ts");
    assert.match(detectCaller, /can_access_client_phi/);
    assert.match(detectCaller, /isAgencyAdmin/);
    assert.match(detectCaller, /supabaseAdmin/);

    const referralCaller = read("../../src/lib/referral-docs.functions.ts");
    assert.match(referralCaller, /readSupabaseServiceRoleKey/);
    assert.doesNotMatch(referralCaller, /getRequest\(\)/);
  });

  it("removes undeployed functions that nothing calls", () => {
    for (const name of [
      "create-training-checkout",
      "format-training-content",
      "training-stripe-webhook",
      "auto-renew-trainings",
      "create-training-setup-intent",
      "parse-receipt-ocr",
    ]) {
      assert.equal(
        existsSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url)),
        false,
      );
    }
    const config = read("../../supabase/config.toml");
    assert.doesNotMatch(
      config,
      /create-training-checkout|format-training-content|training-stripe-webhook|auto-renew-trainings|create-training-setup-intent|parse-receipt-ocr/,
    );
    assert.doesNotMatch(read("../../src/routes/dashboard.pba-ledger.tsx"), /parse-receipt-ocr/);
    assert.doesNotMatch(
      read("../../src/routes/dashboard.hive-training.index.tsx"),
      /auto-renew-trainings|create-training-setup-intent/,
    );
  });

  it("does not call notify_incident_filed or flag_member_deactivated as the signed-in user", () => {
    const lifecycle = read("../../src/lib/lifecycle.functions.ts");
    assert.match(lifecycle, /supabaseAdmin\.rpc\("flag_member_deactivated"/);
    assert.doesNotMatch(lifecycle, /(?<!Admin)\.rpc\("flag_member_deactivated"/);

    const root = new URL("../../src/", import.meta.url).pathname;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const next = join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "integrations") continue;
          walk(next);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(ent.name) || ent.name.endsWith(".test.ts")) continue;
        const src = readFileSync(next, "utf8");
        if (src.includes("notify_incident_filed")) hits.push(next);
        if (
          src.includes('rpc("flag_member_deactivated"') &&
          !next.endsWith("lifecycle.functions.ts")
        ) {
          hits.push(next);
        }
      }
    };
    walk(root);
    assert.deepEqual(hits, []);
  });
});
