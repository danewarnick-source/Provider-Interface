import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCatalogCoverageReport } from "./catalog-coverage.ts";
import { readCommittedCatalog } from "./draft-rules/catalog-fs.ts";

describe("DHHS91172 catalog coverage", () => {
  it("covers every imported parent and treats elements as children, not tasks", () => {
    const report = buildCatalogCoverageReport(readCommittedCatalog());
    assert.equal(report.counts.importedParents, 760);
    assert.equal(report.counts.importedElements, 607);
    assert.equal(report.counts.importedRows, 1367);
    assert.ok(report.counts.executable >= 48);
    assert.equal(report.counts.published, 0);
    assert.equal(report.counts.verified, 0);
    assert.equal(report.counts.wiredFirstBatch, 5);
    assert.equal(report.counts.wiredSecondBatch, 6);
    assert.equal(report.counts.wiredThirdBatch, 3);
    assert.equal(report.counts.wiredFourthBatch, 4);
    assert.equal(report.counts.wired, 18);

    const driving = report.rows.find((r) => r.requirementKey === "REQ-1.30");
    assert.ok(driving);
    assert.equal(driving.liveKey, "driving_record_transport");
    assert.equal(driving.canPublish, true);
    assert.equal(driving.canActivate, false);
    assert.equal(driving.mintsStaffTask, false);
    assert.equal(report.counts.elementOfParent, 607);

    const orientation = report.rows.find((r) => r.requirementKey === "REQ-1.8.4");
    assert.ok(orientation);
    assert.equal(orientation.role, "parent");
    assert.equal(orientation.liveKey, "orientation_30_day");
    assert.equal(orientation.implementationStatus, "live_mapped");
    assert.equal(orientation.mintsStaffTask, false);
    assert.equal(orientation.canPublish, true);
    assert.equal(orientation.canActivate, false);
    assert.equal(orientation.publication, "not_published");

    const usor = report.rows.find((r) => r.requirementKey === "REQ-30.6.a");
    assert.ok(usor);
    assert.equal(usor.liveKey, "usor_job_coaching_sei");
    assert.equal(usor.canPublish, true);
    assert.equal(usor.canActivate, false);
    const sjdAcre = report.rows.find((r) => r.requirementKey === "REQ-33.5.b");
    assert.ok(sjdAcre);
    assert.equal(sjdAcre.liveKey, "acre_sjd");
    assert.equal(sjdAcre.canPublish, true);
    assert.equal(sjdAcre.canActivate, false);
    const sjdCe = report.rows.find((r) => r.requirementKey === "REQ-33.5.c");
    assert.ok(sjdCe);
    assert.equal(sjdCe.liveKey, "customized_employment_usu");
    assert.equal(sjdCe.canPublish, true);
    assert.equal(sjdCe.canActivate, false);

    const periodic = report.rows.find((r) => r.requirementKey === "REQ-1.25");
    assert.ok(periodic);
    assert.equal(periodic.liveKey, "sei_monthly_summary_upi");
    assert.equal(periodic.canPublish, true);
    assert.equal(periodic.canActivate, false);
    const seiMonthly = report.rows.find((r) => r.requirementKey === "REQ-30.3.4");
    assert.ok(seiMonthly);
    assert.equal(seiMonthly.liveKey, "sei_monthly_summary_upi");
    assert.equal(seiMonthly.canPublish, true);
    const cmpMonthly = report.rows.find((r) => r.requirementKey === "REQ-32.3.2");
    assert.ok(cmpMonthly);
    assert.equal(cmpMonthly.liveKey, "cmp_cms_monthly_summaries");
    assert.equal(cmpMonthly.canPublish, true);
    const sjdMonthly = report.rows.find((r) => r.requirementKey === "REQ-33.3.4");
    assert.ok(sjdMonthly);
    assert.equal(sjdMonthly.liveKey, "sjd_monthly_summary_upi");
    assert.equal(sjdMonthly.canPublish, true);

    const elements = report.rows.filter((r) => r.role === "element");
    assert.equal(elements.length, 607);
    assert.ok(elements.every((r) => r.mintsStaffTask === false));
    assert.ok(elements.every((r) => r.implementationStatus === "element_of_parent"));
  });
});
