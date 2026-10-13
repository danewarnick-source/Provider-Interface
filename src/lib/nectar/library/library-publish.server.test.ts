import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library-publish.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.search(new RegExp(`(export )?(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const next = SRC.slice(start + 1).search(/\n\/\*\*|\n(export )?(async )?function /);
  return SRC.slice(start, next < 0 ? undefined : start + 1 + next);
}

describe("library-publish.server.ts (N3)", () => {
  it("publishing a draft sets Published with a review date a year out, then indexes it in the same call", () => {
    const publish = body("publishDocument");
    assert.match(publish, /if \(doc\.library_status !== "draft"\) \{/);
    assert.match(
      publish,
      /const reviewDue = doc\.review_due \?\? defaultReviewDue\(denverYmd\(\)\);/,
    );
    assert.match(publish, /library_status: "published"/);
    assert.ok(
      publish.indexOf("await updateSearch(caller, doc)") >
        publish.indexOf('library_status: "published"'),
    );
  });

  it("a new version is the next number on the same chain, for the same people, published", () => {
    const next = body("publishNewVersion");
    assert.match(next, /version: current\.version \+ 1,/);
    assert.match(next, /parent_document_id: chainRootId\(current\),/);
    assert.match(
      next,
      /audience_all: current\.audience_all,\s*policy_assigned_users: current\.policy_assigned_users,/,
    );
    assert.match(next, /library_status: "published",/);
  });

  it("the old version is kept: archived with superseded_by, and out of search", () => {
    const next = body("publishNewVersion");
    assert.match(
      next,
      /superseded_by: next\.id,\s*superseded_at: now,\s*is_current: false,\s*library_status: "archived",/,
    );
    assert.match(next, /await retireSections\(db, \{ documentId: current\.id \}\);/);
    assert.ok(next.indexOf("await updateSearch(caller, fresh)") > next.indexOf("retireSections"));
  });

  it("archive keeps the row and takes its sections out of search", () => {
    const archive = body("archiveDocument");
    assert.match(archive, /library_status: "archived",\s*archived_at: now,\s*archived_by: userId,/);
    assert.match(archive, /await retireSections\(db, \{ documentId: doc\.id \}\);/);
    assert.doesNotMatch(SRC, /\.delete\(|\.remove\(/);
  });

  it("search makes embeddings only while Nectar and Ask are on, within the publish time budget", () => {
    const search = body("updateSearch");
    assert.match(
      search,
      /embed: shouldEmbed\(settings\), deadline: Date\.now\(\) \+ PUBLISH_EMBED_BUDGET_MS/,
    );
    assert.match(search, /indexLibraryBacklog\(db, orgId, opts\)/);
    assert.match(
      search,
      /console\.error\("\[knowledge-base\] search update failed", \{\s*organizationId: orgId,\s*documentId: doc\?\.id \?\? null,\s*\}\)/,
    );
  });
});
