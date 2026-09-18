import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Knowledge surface lock", () => {
  it("is a single upload + list page with no retired Knowledge tabs", () => {
    const hub = read("../routes/dashboard.hub.knowledge.tsx");
    assert.match(hub, /KnowledgePage/);
    assert.doesNotMatch(hub, /HubShell/);
    assert.doesNotMatch(hub, /AuthoritativeSourcesPage/);
    assert.doesNotMatch(hub, /NectarDocsPage/);
    assert.doesNotMatch(hub, /ExternalCompliancePage/);
    assert.doesNotMatch(hub, /Company docs/);
    assert.doesNotMatch(hub, /External compliance/);
    assert.doesNotMatch(hub, /Authoritative sources/);
  });

  it("frames Knowledge as Nectar document ingest, not compliance tracing", () => {
    const page = read("../components/pages/knowledge-page.tsx");
    assert.match(page, /Nectar ingests them into its knowledge base/);
    assert.match(page, /Nectar search/);
    assert.doesNotMatch(page, /Requirements/);
    assert.doesNotMatch(page, /Draft requirements/);
    assert.doesNotMatch(page, /Auto-classify/);
    assert.doesNotMatch(page, /guarantee compliance/);
    assert.doesNotMatch(page, /power everything NECTAR shows/);
    assert.doesNotMatch(page, /[\u{1F300}-\u{1FAFF}]/u);
    const uploadIdx = page.indexOf("<UploadCard");
    const listIdx = page.indexOf("<DocumentList");
    assert.ok(uploadIdx >= 0 && listIdx > uploadIdx, "upload sits above the document list");
  });

  it("retires External compliance and Authoritative Sources to Knowledge", () => {
    const ext = read("../routes/dashboard.external-compliance.tsx");
    assert.match(ext, /to: "\/dashboard\/hub\/knowledge"/);
    assert.doesNotMatch(ext, /tab: "external"/);
    const auth = read("../routes/dashboard.authoritative-sources.tsx");
    assert.match(auth, /to: "\/dashboard\/hub\/knowledge"/);
  });
});
