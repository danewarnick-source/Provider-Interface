import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

// Replaces knowledge-page.lock.test.ts (N4): the Knowledge base screens.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const lines = (src: string) => src.split("\n").length;
const KNOWLEDGE_DIR = new URL("../components/knowledge/", import.meta.url);
const components = readdirSync(KNOWLEDGE_DIR).filter((f) => /\.tsx?$/.test(f));
const all = components.map((f) => [f, readFileSync(new URL(f, KNOWLEDGE_DIR), "utf8")] as const);

describe("Knowledge base screens (N4)", () => {
  it("the route renders components/knowledge/knowledge-page.tsx behind the admin gate", () => {
    const route = read("../routes/dashboard.hub.knowledge.tsx");
    assert.ok(lines(route) <= 80);
    assert.match(
      route,
      /import \{ KnowledgePage \} from "@\/components\/knowledge\/knowledge-page"/,
    );
    assert.match(route, /<RequireLevel min="admin" redirectTo="\/dashboard\/ask-nectar">/);
    assert.match(route, /<FeatureGate featureKey="nectar">/);
    assert.match(
      route,
      /validateSearch: \(s: Record<string, unknown>\) => parseKnowledgeSearch\(s\)/,
    );
  });

  it("the old Knowledge page, drop zone and Company policies tab are gone", () => {
    for (const rel of [
      "../components/pages/knowledge-page.tsx",
      "../components/nectar/authoritative-source-drop.tsx",
      "../components/agency-documents/company-policies-tab.tsx",
      "./knowledge-page.lock.test.ts",
    ]) {
      assert.equal(existsSync(new URL(rel, import.meta.url)), false, rel);
    }
  });

  it("every Knowledge base component fits the size limit and keeps Nectar data out of the browser", () => {
    assert.ok(components.length >= 10);
    for (const [file, src] of all) {
      assert.ok(lines(src) <= 250, `${file} is ${lines(src)} lines`);
      assert.doesNotMatch(src, /localStorage|sessionStorage/, file);
      assert.doesNotMatch(src, /console\./, file);
      assert.doesNotMatch(src, /deleteDocument|\.delete\(|\.remove\(/, file);
      assert.doesNotMatch(src, /base64|btoa\(/i, file);
    }
  });

  it("uses the demo's wording: header, tabs, columns and the required-policy toggles", () => {
    const text = all.map(([, src]) => src).join("\n");
    for (const phrase of [
      'title="Knowledge base"',
      "Your agency's policies, procedures and the state rules. Nectar answers only from what's published here.",
      "New document",
      "Required policies",
      "missing)",
      "Reviews",
      "No documents yet.",
      "We provide transportation",
      "We manage clients' personal money",
      "No document yet",
      "Each team member marks a policy as reviewed on their phone.",
      "Policy review record:",
      "Fills a required policy",
      "Saved as a draft. Nectar won't use it until you publish it.",
      "Back to Knowledge base",
      "Publish new version",
      "Edit draft",
      "Archive",
      "Who it's for",
      "All team members",
      "Only the people I check",
      "Check at least one person, or nobody will see it.",
      "Only these people see it, are asked to review it, and get Nectar answers from it.",
      "Versions",
    ]) {
      assert.ok(text.includes(phrase), phrase);
    }
  });

  it("New document takes typed text or a PDF, Word or text file sent with a signed upload URL", () => {
    const upload = read("../components/knowledge/use-library-upload.ts");
    assert.match(upload, /useServerFn\(createLibraryUploadUrl\)/);
    assert.match(upload, /\.uploadToSignedUrl\(signed\.path, signed\.token, file/);
    const form = read("../components/knowledge/new-document.tsx");
    assert.match(
      form,
      /createFn\(\{ data: \{ \.\.\.base, upload: await upload\(source\.file!\) \} \}\)/,
    );
    assert.match(form, /resolvesQuestionId: questionId/);
  });

  it("the printable record prints only the record, with a print stylesheet", () => {
    const record = read("../components/knowledge/review-record.tsx");
    assert.match(record, /<style>\{REVIEW_RECORD_PRINT_CSS\}<\/style>/);
    assert.match(record, /createPortal\(/);
    assert.match(record, /window\.print\(\)/);
  });

  it("a refused call shows a plain no-access state instead of a crash", () => {
    const states = read("../components/knowledge/knowledge-states.tsx");
    assert.match(states, /You don't have access to the Knowledge base/);
    // Every screen that reads data shows a failed or refused read. (The page header's
    // "(N missing)" count just stays hidden; the Required policies tab shows the error.)
    const screens = all.filter(
      ([f, s]) =>
        f.endsWith(".tsx") &&
        f !== "knowledge-page.tsx" &&
        /useQuery\(|useRequiredPolicies\(/.test(s),
    );
    assert.ok(screens.length >= 8);
    for (const [file, src] of screens) {
      assert.match(src, /KnowledgeError|q\.error/, file);
    }
  });

  it("the exec Knowledge page keeps its articles and adds State rules; the route fits", () => {
    const exec = read("../routes/dashboard.hive-exec.knowledge.tsx");
    assert.ok(lines(exec) <= 80);
    assert.match(exec, /<RequireCapability cap="knowledge\.manage">/);
    assert.match(exec, /<KnowledgeArticles \/>/);
    assert.match(exec, /<StateRulesSection \/>/);
    assert.ok(lines(read("../components/hive-exec/knowledge-articles.tsx")) <= 250);
  });

  it("Company Docs no longer uploads company documents", () => {
    const docs = read("../components/pages/nectar-docs-page.tsx");
    assert.match(
      docs,
      /const UPLOAD_OWNER_KINDS = OWNER_KINDS\.filter\(\(t\) => t\.value !== "all" && t\.value !== "company"\);/,
    );
    assert.match(docs, /\{UPLOAD_OWNER_KINDS\.map\(/);
  });
});
