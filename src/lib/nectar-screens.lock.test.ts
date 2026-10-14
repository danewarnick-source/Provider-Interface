import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

// N6: the Nectar screens. Admin /dashboard/help (Ask, Questions, AI settings)
// and team member /dashboard/ask-nectar (Ask, Policies), as in the demo.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const lines = (src: string) => src.split("\n").length;

function components(dir: string) {
  const url = new URL(dir, import.meta.url);
  return readdirSync(url)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => [`${dir}${f}`, readFileSync(new URL(f, url), "utf8")] as const);
}

const ADMIN = components("../components/nectar/admin/");
const STAFF = components("../components/nectar/staff/");
const SHARED = [
  "../components/nectar/chat-parts.tsx",
  "../components/nectar/nectar-reply.tsx",
  "../components/nectar/use-ask-nectar.ts",
  "../components/nectar/use-nectar-chat.ts",
].map((rel) => [rel, read(rel)] as const);
const ALL = [...ADMIN, ...STAFF, ...SHARED];
const TEXT = ALL.map(([, src]) => src).join("\n") + read("./nectar/engine/ask-types.ts");

describe("Nectar screens (N6)", () => {
  it("admin /dashboard/help renders the three-tab Nectar page behind the admin gate", () => {
    const route = read("../routes/dashboard.help.tsx");
    assert.ok(lines(route) <= 80);
    assert.match(route, /import \{ NectarPage \} from "@\/components\/nectar\/admin\/nectar-page"/);
    assert.match(route, /<RequireLevel min="admin" redirectTo="\/dashboard\/ask-nectar">/);
    assert.match(route, /<FeatureGate featureKey="nectar">\s*<NectarPage \/>/);
    assert.match(
      route,
      /validateSearch: \(s: Record<string, unknown>\) => parseAdminNectarSearch\(s\)/,
    );
  });

  it("team member /dashboard/ask-nectar keeps its route and renders components/nectar/staff", () => {
    const route = read("../routes/dashboard.ask-nectar.tsx");
    assert.ok(lines(route) <= 80);
    assert.match(
      route,
      /import \{ StaffNectarPage \} from "@\/components\/nectar\/staff\/staff-nectar-page"/,
    );
    assert.match(route, /<FeatureGate featureKey="nectar">/);
    assert.match(
      route,
      /validateSearch: \(s: Record<string, unknown>\) => parseStaffNectarSearch\(s\)/,
    );
    // No change to the staff bottom tabs.
    const tabs = read("../components/staff-mobile/staff-bottom-tabs.tsx");
    assert.match(tabs, /\{ to: "\/dashboard\/ask-nectar", label: "Ask NECTAR"/);
  });

  it("the old staff chat and the N5 help chat files are gone", () => {
    for (const rel of [
      "../components/staff-mobile/ask-nectar-staff.tsx",
      "../components/nectar/admin/help-chat.tsx",
      "../components/nectar/admin/help-chat-header.tsx",
      "../components/nectar/admin/help-chat-parts.tsx",
    ]) {
      assert.equal(existsSync(new URL(rel, import.meta.url)), false, rel);
    }
  });

  it("the typed-signature page is a redirect to that policy in the Policies tab, and can't loop", () => {
    const page = read("../routes/sign-policy.$documentId.tsx");
    assert.ok(lines(page) <= 80);
    assert.match(page, /throw redirect\(\{\s*to: "\/dashboard\/ask-nectar",/);
    assert.match(page, /parseStaffNectarSearch\(\{ tab: "policies", doc: params\.documentId \}\)/);
    assert.doesNotMatch(page, /typed_signature|policy_signatures|insert\(/);
    const root = read("../routes/__root.tsx");
    assert.match(root, /const policyPages = \["\/sign-policy\/", "\/dashboard\/ask-nectar"\];/);
    assert.match(
      root,
      /if \(policyPages\.some\(\(p\) => location\.pathname\.startsWith\(p\)\)\) return;/,
    );
  });

  it("every Nectar screen fits the size limit and keeps Nectar data out of the browser", () => {
    assert.ok(ADMIN.length >= 6 && STAFF.length >= 6);
    for (const [file, src] of ALL) {
      assert.ok(lines(src) <= 250, `${file} is ${lines(src)} lines`);
      assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, file);
      assert.doesNotMatch(src, /console\./, file);
      assert.doesNotMatch(src, /\.delete\(|\.remove\(/, file);
    }
  });

  it("uses the demo's wording", () => {
    for (const phrase of [
      'title="Nectar"',
      "Nectar is an AI assistant. It answers only from your published documents, the state rules and your agency's records, and it shows where every answer came from.",
      "Nectar · AI assistant",
      "Sources:",
      "Thanks. Sent to your admin to review.",
      "Questions Nectar couldn't answer, and answers someone marked not helpful.",
      "open)",
      "AI settings",
      "Add to library",
      "Mark resolved",
      "Reopen",
      "Nothing here.",
      "Ask is turned off for your agency.",
      "Nectar is an AI assistant. It answers from your agency's policies, the state contract and the plans of the people you support",
      "Mark as reviewed",
      "Guide me",
      "Ask the PI team",
    ]) {
      assert.ok(TEXT.includes(phrase), phrase);
    }
    assert.doesNotMatch(TEXT, /\bassigned to\b/i, "no assignment on questions (Decision 9)");
  });

  it("staff screens never link into the admin-only Knowledge base", () => {
    for (const [file, src] of STAFF) {
      assert.doesNotMatch(src, /hub\/knowledge|adminSourceHref|knowledgeHref/, file);
    }
  });
});
