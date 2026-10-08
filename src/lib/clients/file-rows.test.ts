import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceFileRow, EvidenceItemRow } from "../evidence/types.ts";
import { planClientPacks, type ClientPackRow } from "./file-packs.ts";
import {
  buildClientFile,
  fileAttention,
  packOrigin,
  sowHint,
  type ClientFileInput,
} from "./file-rows.ts";

const TODAY = "2026-10-07";

function item(key: string, over: Partial<EvidenceItemRow> = {}): EvidenceItemRow {
  return {
    id: `item-${key}`,
    organization_id: "org",
    subject_type: "client",
    subject_id: "client-1",
    requirement_key: key,
    title: key,
    evidence_type: "upload",
    attestation_text: null,
    cadence: "keep_current",
    sow_cite: null,
    suggested: true,
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
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function file(itemId: string, over: Partial<EvidenceFileRow> = {}): EvidenceFileRow {
  return {
    id: `file-${itemId}`,
    organization_id: "org",
    item_id: itemId,
    storage_path: `org/${itemId}/a.pdf`,
    filename: "a.pdf",
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: "u",
    uploaded_at: "2026-09-02T00:00:00Z",
    notes: null,
    review_status: "accepted",
    ...over,
  };
}

const core: ClientPackRow = {
  pack_key: "client_core",
  origin: "code",
  removed_at: null,
  removed_reason: null,
};

function fileFor(over: Partial<ClientFileInput> & { items: EvidenceItemRow[] }): ClientFileInput {
  const clientPacks = over.clientPacks ?? [core];
  const activeCodes = over.activeCodes ?? [];
  const plan = planClientPacks({
    activeCodes,
    endedCodes: [],
    clientPacks,
    agencyPackKeys: new Set(clientPacks.map((p) => p.pack_key)),
    items: over.items,
    ownGuardian: false,
  });
  return {
    files: [],
    plan,
    clientPacks,
    activeCodes,
    ownGuardian: false,
    elsewhere: {},
    today: TODAY,
    ...over,
  };
}

describe("Client file rows", () => {
  it("every row explains itself with the catalog why", () => {
    const groups = buildClientFile(fileFor({ items: [] }));
    const rows = groups.flatMap((g) => g.rows);
    assert.ok(rows.length > 0);
    for (const r of rows) assert.ok(r.why.length > 20, r.key);
    const grievance = rows.find((r) => r.key === "grievance_receipt")!;
    assert.match(grievance.why, /grievance process in writing/);
    assert.equal(grievance.sowHint, "SOW §1.10(11)");
  });

  it("shows On file with the expiry date, and Missing when nothing is on file", () => {
    const exam = item("grievance_receipt", { next_due_on: "2027-09-01" });
    const groups = buildClientFile(
      fileFor({ items: [exam, item("guardian_papers")], files: [file(exam.id)] }),
    );
    const rows = new Map(groups.flatMap((g) => g.rows).map((r) => [r.key, r]));
    assert.equal(rows.get("grievance_receipt")!.label, "On file · expires Sep 1, 2027");
    assert.equal(rows.get("guardian_papers")!.label, "Missing");
  });

  it("a waived row reads Not needed and never counts in Needs attention", () => {
    const photoless = item("guardian_papers", {
      opted_out_at: "2026-09-03T00:00:00Z",
      opt_out_reason: "Kept outside PI",
    });
    const groups = buildClientFile(fileFor({ items: [photoless] }));
    const row = groups.flatMap((g) => g.rows).find((r) => r.key === "guardian_papers")!;
    assert.equal(row.state, "not_needed");
    assert.equal(row.label, "Not needed: Kept outside PI");
    assert.equal(
      fileAttention(groups).some((a) => a.key === "guardian_papers"),
      false,
    );
    assert.ok(fileAttention(groups).some((a) => a.key === "grievance_receipt"));
  });

  it("the 1056 copy and other papers are optional, never Missing", () => {
    const rows = buildClientFile(fileFor({ items: [] })).flatMap((g) => g.rows);
    const copy = rows.find((r) => r.key === "copy_1056")!;
    assert.equal(copy.state, "optional");
    assert.equal(copy.title, "Copy of the 1056 (optional)");
    assert.equal(
      fileAttention([{ key: "x", title: "", description: "", origin: "", rows }]).some(
        (a) => a.key === "copy_1056" || a.key === "clinical_legal_uploads",
      ),
      false,
    );
  });

  it("rows kept elsewhere take their status from there and stay out of Needs attention", () => {
    const groups = buildClientFile(
      fileFor({ items: [], elsewhere: { client_pcsp: { onFile: true, dueOn: "2027-06-30" } } }),
    );
    const rows = groups.flatMap((g) => g.rows);
    const pcsp = rows.find((r) => r.key === "client_pcsp")!;
    assert.equal(pcsp.keptIn, "plans");
    assert.equal(pcsp.state, "on_file");
    assert.equal(
      fileAttention(groups).some((a) => a.key === "client_photo"),
      false,
    );
  });

  it("support strategies follow the send rule, not an older Evidence file", () => {
    const ss = item("support_strategies");
    const old = file(ss.id);
    const notSent = buildClientFile(
      fileFor({
        items: [ss],
        files: [old],
        elsewhere: { support_strategies: { onFile: false, dueOn: "2026-10-20", ruled: true } },
      }),
    )
      .flatMap((g) => g.rows)
      .find((r) => r.key === "support_strategies")!;
    assert.equal(notSent.state, "due_soon");
    assert.equal(notSent.file, null);
    const sent = buildClientFile(
      fileFor({
        items: [ss],
        files: [old],
        elsewhere: {
          support_strategies: { onFile: true, dueOn: null, ruled: true, note: "Sent to Angela Duty" },
        },
      }),
    )
      .flatMap((g) => g.rows)
      .find((r) => r.key === "support_strategies")!;
    assert.equal(sent.state, "on_file");
    assert.equal(sent.note, "Sent to Angela Duty");
    assert.equal(sent.file?.filename, "a.pdf");
  });

  it("groups rows by pack, each key once, with where the pack came from", () => {
    const packs: ClientPackRow[] = [
      core,
      { pack_key: "hhs_client", origin: "code", removed_at: null, removed_reason: null },
      { pack_key: "rhs_client", origin: "code", removed_at: null, removed_reason: null },
    ];
    const groups = buildClientFile(
      fileFor({ items: [], clientPacks: packs, activeCodes: ["HHS", "RHS"] }),
    );
    assert.deepEqual(
      groups.map((g) => [g.key, g.origin]),
      [
        ["client_core", "Every client"],
        ["hhs_client", "From HHS"],
        ["rhs_client", "From RHS"],
      ],
    );
    const keys = groups.flatMap((g) => g.rows.map((r) => r.key));
    assert.equal(keys.length, new Set(keys).size);
  });

  it("shows retired rows under Not needed any more, with the code that ended", () => {
    const packs: ClientPackRow[] = [
      core,
      { pack_key: "hhs_client", origin: "code", removed_at: null, removed_reason: null },
    ];
    const items = [item("room_board_agreement")];
    const plan = planClientPacks({
      activeCodes: [],
      endedCodes: [{ code: "HHS", endedOn: "2026-08-31" }],
      clientPacks: packs,
      agencyPackKeys: new Set(["client_core", "hhs_client"]),
      items,
      ownGuardian: false,
    });
    const groups = buildClientFile(fileFor({ items, clientPacks: packs, plan }));
    const last = groups.at(-1)!;
    assert.equal(last.key, "not_needed");
    assert.equal(last.rows[0]!.label, "Not needed: HHS ended Aug 31, 2026");
  });

  it("hand-added items get their own group", () => {
    const custom = item("custom:abc", {
      title: "Bus pass",
      added_by_hand: true,
      description: "A copy of the monthly bus pass for outings.",
    });
    const groups = buildClientFile(fileFor({ items: [custom] }));
    const hand = groups.find((g) => g.key === "by_hand")!;
    assert.equal(hand.rows[0]!.title, "Bus pass");
    assert.equal(hand.rows[0]!.why, "A copy of the monthly bus pass for outings.");
    assert.equal(packOrigin("sei_client", []), "Added by hand");
  });

  it("only shows the § hint for one confirmed section", () => {
    assert.equal(sowHint("SOW §21.3(1)"), "SOW §21.3(1)");
    assert.equal(sowHint("SOW §3/4/5.3"), null);
    assert.equal(sowHint("SOW SLH"), null);
    assert.equal(sowHint(""), null);
  });
});
