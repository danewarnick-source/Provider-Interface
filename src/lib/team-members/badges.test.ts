import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { EvidenceFileRow } from "../evidence/types.ts";
import {
  ageOn,
  driveCheck,
  evidenceItemBadge,
  formatLocalDate,
  needsTransportSuggestion,
  profileBadges,
  type BadgeEvidenceItem,
} from "./badges.ts";

const TODAY = "2026-09-28";
const ORG = "org";
const STAFF = "staff-1";

function item(key: string, over: Partial<BadgeEvidenceItem> = {}): BadgeEvidenceItem {
  return {
    id: `item-${key}`,
    organization_id: ORG,
    subject_type: "staff",
    subject_id: STAFF,
    requirement_key: key,
    title: key,
    evidence_type: "upload",
    attestation_text: null,
    cadence: "once",
    sow_cite: null,
    suggested: false,
    sent_to_staff: false,
    visible_to_staff_id: null,
    dual_link_key: null,
    dual_link_peer_id: null,
    expires_on: null,
    first_due_rule: null,
    first_due_on: null,
    document_date: null,
    next_due_on: null,
    renew_years: null,
    send_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  } as BadgeEvidenceItem;
}

function file(itemId: string, over: Partial<EvidenceFileRow> = {}): EvidenceFileRow {
  return {
    id: `file-${itemId}`,
    organization_id: ORG,
    item_id: itemId,
    storage_path: "org/staff/x.pdf",
    filename: "x.pdf",
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: null,
    uploaded_at: "2026-03-04T15:00:00Z",
    notes: null,
    ...over,
  };
}

const bg = (
  items: BadgeEvidenceItem[],
  files: EvidenceFileRow[],
  nameOf?: (id: string) => string | null,
) =>
  evidenceItemBadge({
    key: "background",
    requirementKey: "background_screening",
    prefix: "Background",
    doneVerb: "on file",
    items,
    files,
    today: TODAY,
    nameOf,
  });

describe("formatLocalDate / ageOn", () => {
  it("formats YYYY-MM-DD as the same local calendar day", () => {
    assert.equal(formatLocalDate("2026-03-04"), new Date(2026, 2, 4).toLocaleDateString());
    assert.equal(formatLocalDate(null), "");
    assert.equal(formatLocalDate("nope"), "");
  });

  it("counts whole years, the day before a birthday is still the younger age", () => {
    assert.equal(ageOn("2008-09-28", TODAY), 18);
    assert.equal(ageOn("2008-09-29", TODAY), 17);
    assert.equal(ageOn(null, TODAY), null);
  });
});

describe("Background / OIG badges from Evidence", () => {
  it("on file with the document date", () => {
    const i = item("background_screening", { document_date: "2026-03-04" });
    const b = bg([i], [file(i.id)]);
    assert.equal(b.tone, "ok");
    assert.equal(b.label, `Background on file ${formatLocalDate("2026-03-04")}`);
  });

  it("falls back to the upload date", () => {
    const i = item("background_screening");
    assert.equal(
      bg([i], [file(i.id)]).label,
      `Background on file ${formatLocalDate("2026-03-04")}`,
    );
  });

  it("due when assigned and empty; missing when past due or absent", () => {
    const upcoming = item("background_screening", { first_due_on: "2026-10-10" });
    assert.equal(bg([upcoming], []).label, "Background due");
    const noDate = item("background_screening");
    assert.equal(bg([noDate], []).label, "Background due");
    const late = item("background_screening", { first_due_on: "2026-09-01" });
    assert.equal(bg([late], []).label, "Background missing");
    assert.equal(bg([], []).label, "Background missing");
  });

  it("expired renewals are missing", () => {
    const i = item("background_screening", { next_due_on: "2026-09-01" });
    assert.equal(bg([i], [file(i.id)]).label, "Background missing");
  });

  it("skipped names who skipped it", () => {
    const i = item("background_screening", {
      opted_out_at: "2026-09-01T00:00:00Z",
      opted_out_by: "u1",
    });
    assert.equal(
      bg([i], [], (id) => (id === "u1" ? "Pat Lee" : null)).label,
      "Background skipped by Pat Lee",
    );
    assert.equal(bg([i], []).label, "Background skipped");
  });

  it("OIG says checked", () => {
    const i = item("oig_exclusion", { document_date: "2026-09-01" });
    const badges = profileBadges({
      items: [i],
      files: [file(i.id)],
      today: TODAY,
      transportsClients: false,
      dateOfBirth: null,
    });
    assert.equal(
      badges.find((b) => b.key === "oig")?.label,
      `OIG checked ${formatLocalDate("2026-09-01")}`,
    );
  });
});

describe("Can drive clients", () => {
  const license = item("driver_license");
  const insurance = item("auto_insurance_proof");
  const files = [file(license.id), file(insurance.id)];

  it("hidden unless the person transports clients", () => {
    assert.equal(
      driveCheck({
        transportsClients: false,
        dateOfBirth: "1990-01-01",
        items: [],
        files: [],
        today: TODAY,
      }).show,
      false,
    );
    const badges = profileBadges({
      items: [license],
      files,
      today: TODAY,
      transportsClients: false,
      dateOfBirth: null,
    });
    assert.equal(
      badges.some((b) => b.key === "drive"),
      false,
    );
  });

  it("ok at 18+ with license and insurance both complete", () => {
    const d = driveCheck({
      transportsClients: true,
      dateOfBirth: "1990-01-01",
      items: [license, insurance],
      files,
      today: TODAY,
    });
    assert.deepEqual(d, { show: true, ok: true, missing: [] });
  });

  it("lists what is missing", () => {
    const d = driveCheck({
      transportsClients: true,
      dateOfBirth: "2010-01-01",
      items: [license],
      files: [file(license.id)],
      today: TODAY,
    });
    assert.equal(d.ok, false);
    assert.deepEqual(d.missing, ["Must be 18 or older", "Auto insurance"]);
    const noDob = driveCheck({
      transportsClients: true,
      dateOfBirth: null,
      items: [],
      files: [],
      today: TODAY,
    });
    assert.deepEqual(noDob.missing, ["Date of birth", "Driver's license", "Auto insurance"]);
  });
});

describe("No evidence pack and transport suggestion", () => {
  it("adds No evidence pack only when there are no items", () => {
    const none = profileBadges({
      items: [],
      files: [],
      today: TODAY,
      transportsClients: false,
      dateOfBirth: null,
    });
    assert.equal(none.at(-1)?.key, "no_pack");
    const some = profileBadges({
      items: [item("oig_exclusion")],
      files: [],
      today: TODAY,
      transportsClients: false,
      dateOfBirth: null,
    });
    assert.equal(
      some.some((b) => b.key === "no_pack"),
      false,
    );
  });

  it("suggests transport items only with a pack that lacks them", () => {
    assert.equal(needsTransportSuggestion(true, []), false);
    assert.equal(needsTransportSuggestion(false, [item("oig_exclusion")]), false);
    assert.equal(needsTransportSuggestion(true, [item("oig_exclusion")]), true);
    assert.equal(needsTransportSuggestion(true, [item("driver_license")]), true);
    assert.equal(
      needsTransportSuggestion(true, [item("driver_license"), item("auto_insurance_proof")]),
      false,
    );
  });
});

describe("badges source lock", () => {
  it("reads Evidence status helpers, never company obligations", () => {
    const src = readFileSync(new URL("./badges.ts", import.meta.url), "utf8");
    assert.match(src, /from "\.\.\/evidence\/status\.ts"/);
    assert.doesNotMatch(src.replace(/^\/\/.*$/gm, ""), /company_obligation/);
  });
});
