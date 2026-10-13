import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DRAFT_JOBS_POLL_MS, draftJobsPollInterval, draftJobsQueryEnabled } from "./draft-jobs-poll.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("draft-job polling (N1)", () => {
  it("runs only for owners and agency-wide admins with an agency", () => {
    assert.equal(draftJobsQueryEnabled(ORG, true), true);
    assert.equal(draftJobsQueryEnabled(ORG, false), false);
    assert.equal(draftJobsQueryEnabled(null, true), false);
    assert.equal(draftJobsQueryEnabled(undefined, false), false);
  });

  it("polls every 5 seconds only while a job exists", () => {
    assert.equal(DRAFT_JOBS_POLL_MS, 5_000);
    assert.equal(draftJobsPollInterval([{ jobId: "j1" }]), 5_000);
    assert.equal(draftJobsPollInterval([]), false);
    assert.equal(draftJobsPollInterval(undefined), false);
    assert.equal(draftJobsPollInterval(null), false);
  });

  it("is what the driver uses (the shared dashboard shell stays untouched)", () => {
    const driver = readFileSync(new URL("../../components/nectar/draft-jobs-driver.tsx", import.meta.url), "utf8");
    assert.match(driver, /const \{ isAgencyAdmin \} = useAccess\(\);/);
    assert.match(driver, /enabled: draftJobsQueryEnabled\(orgId, isAgencyAdmin\),/);
    assert.match(driver, /refetchInterval: \(query\) => draftJobsPollInterval\(query\.state\.data\?\.jobs\),/);
    assert.doesNotMatch(driver, /refetchInterval: POLL_INTERVAL_MS/);
  });
});
