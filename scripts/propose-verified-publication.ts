/**
 * Preview the Soft=none controlled publish path.
 * Does not write VERIFIED_PUBLICATIONS. Prints READY snippets and DRAFT reasons.
 *
 * Usage:
 *   node --experimental-strip-types scripts/propose-verified-publication.ts --rule REQ-1.8.4
 *   node --experimental-strip-types scripts/propose-verified-publication.ts --wired
 */
import {
  applyExecutableBatchOverlays,
  buildCatalogCoverageReport,
} from "../src/lib/obligations/catalog-coverage.ts";
import {
  formatVerifiedPublicationSnippet,
  proposeVerifiedPublications,
} from "../src/lib/obligations/draft-rules/controlled-publication.ts";
import { readCommittedCatalog } from "../src/lib/obligations/draft-rules/catalog-fs.ts";
import { VERIFIED_PUBLICATIONS } from "../src/lib/obligations/draft-rules/verified-publication.ts";
import type { ApprovalRecord } from "../src/lib/obligations/draft-rules/types.ts";

function argValues(argv: readonly string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name && argv[i + 1]) {
      values.push(argv[i + 1]!);
      i += 1;
    }
  }
  return values;
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

function main(): void {
  const argv = process.argv.slice(2);
  const ruleIds = argValues(argv, "--rule");
  const wired = hasFlag(argv, "--wired");
  const actorId = argValues(argv, "--actor-id")[0] ?? "REPLACE_ACTOR_ID";
  const actorLabel = argValues(argv, "--actor-label")[0] ?? "REPLACE_ACTOR_LABEL";
  const approvedAt = argValues(argv, "--approved-at")[0] ?? new Date().toISOString();
  if (ruleIds.length === 0 && !wired) {
    process.stderr.write(
      "Usage: propose-verified-publication --rule REQ-x.y [--rule REQ-x.z] | --wired\nOptional: --actor-id --actor-label --approved-at\nDoes not write VERIFIED_PUBLICATIONS.\n",
    );
    process.exitCode = 2;
    return;
  }

  const loaded = readCommittedCatalog();
  const overlaid = applyExecutableBatchOverlays(loaded.parents);
  const report = buildCatalogCoverageReport(loaded);
  const requested = wired
    ? report.rows
        .filter((row) => row.role === "parent" && row.liveKey != null && row.canPublish)
        .map((row) => row.requirementKey)
    : ruleIds;
  const approval: ApprovalRecord = { actorId, actorLabel, approvedAt };
  const decision = proposeVerifiedPublications(overlaid, requested, approval);

  const lines = [
    `Committed VERIFIED_PUBLICATIONS=${VERIFIED_PUBLICATIONS.length} (must stay empty unless a later PR pastes READY rows).`,
    `Requested=${requested.length} ready=${decision.accepted.length} draft=${decision.unresolved.length}`,
    "",
  ];
  for (const row of decision.accepted) {
    lines.push(`${row.ruleId}  READY`);
    lines.push(`  Add this one row to VERIFIED_PUBLICATIONS:`);
    lines.push(`  ${formatVerifiedPublicationSnippet(row)}`);
    lines.push("");
  }
  for (const row of decision.unresolved) {
    lines.push(`${row.ruleId}  DRAFT`);
    for (const reason of row.reasons) lines.push(`  - ${reason}`);
    lines.push("");
  }
  if (decision.accepted.length > 0) {
    lines.push(
      "Paste only the READY rows you intend. Unresolved stay draft. No --all write. Soft=none.",
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
