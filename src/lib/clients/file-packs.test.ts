import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EVIDENCE_PACKS } from "../evidence/catalog.ts";
import {
  NO_SERVICE_REASON,
  OWN_GUARDIAN_REASON,
  PACK_REMOVED_BY_HAND,
  PACK_REMOVED_REASON,
  activeTriggers,
  clientPack,
  codeEndedReason,
  isAutoReason,
  packTriggerCodes,
  planClientPacks,
  requiredKeysFor,
  type ClientPackRow,
  type PackPlanInput,
  type PlanItem,
} from "./file-packs.ts";

const AGENCY = new Set(["client_core", "hhs_client", "rhs_client", "pps_client", "sei_client"]);

function input(over: Partial<PackPlanInput>): PackPlanInput {
  return {
    activeCodes: [],
    endedCodes: [],
    clientPacks: [],
    agencyPackKeys: AGENCY,
    items: [],
    ownGuardian: false,
    ...over,
  };
}
const pack = (key: string, over: Partial<ClientPackRow> = {}): ClientPackRow => ({
  pack_key: key,
  origin: "code",
  removed_at: null,
  removed_reason: null,
  ...over,
});
const item = (key: string, over: Partial<PlanItem> = {}): PlanItem => ({
  id: `item-${key}`,
  requirement_key: key,
  ...over,
});

describe("client packs follow codes", () => {
  it("adds a code's pack rows once the agency has applied that pack", () => {
    const plan = planClientPacks(
      input({ activeCodes: ["HHS"], clientPacks: [pack("client_core")] }),
    );
    assert.deepEqual(plan.addPacks, ["hhs_client"]);
    for (const key of clientPack("hhs_client")!.requirementKeys) {
      assert.ok(plan.addKeys.includes(key), key);
    }
  });

  it("adds nothing for a pack the agency never applied", () => {
    const plan = planClientPacks(
      input({ activeCodes: ["SLH"], clientPacks: [pack("client_core")], agencyPackKeys: AGENCY }),
    );
    assert.deepEqual(plan.addPacks, []);
    assert.equal(plan.addKeys.includes("slh_living_agreement"), false);
  });

  it("shows nothing when the agency applied no packs", () => {
    const plan = planClientPacks(input({ activeCodes: ["HHS"], agencyPackKeys: new Set() }));
    assert.deepEqual(plan.requiredKeys, []);
    assert.deepEqual(plan.addKeys, []);
  });

  it("does not add an item twice", () => {
    const plan = planClientPacks(
      input({
        activeCodes: ["HHS"],
        clientPacks: [pack("client_core"), pack("hhs_client")],
        items: clientPack("hhs_client")!.requirementKeys.map((k) => item(k)),
      }),
    );
    assert.deepEqual(plan.addPacks, []);
    assert.equal(
      plan.addKeys.some((k) => clientPack("hhs_client")!.requirementKeys.includes(k)),
      false,
    );
  });

  it("retires rows when the code ends and no other code needs them", () => {
    const plan = planClientPacks(
      input({
        activeCodes: [],
        endedCodes: [{ code: "HHS", endedOn: "2026-08-31" }],
        clientPacks: [pack("client_core"), pack("hhs_client")],
        items: [
          item("room_board_agreement"),
          item("host_home_cert_client"),
          item("grievance_receipt"),
        ],
      }),
    );
    assert.deepEqual(plan.endPacks, [{ packKey: "hhs_client", reason: "HHS ended Aug 31, 2026" }]);
    const reasons = Object.fromEntries(plan.retireItems.map((r) => [r.id, r.reason]));
    assert.equal(reasons["item-room_board_agreement"], "HHS ended Aug 31, 2026");
    assert.equal(reasons["item-host_home_cert_client"], "HHS ended Aug 31, 2026");
    assert.equal(reasons["item-grievance_receipt"], undefined);
  });

  it("keeps a row another active code still needs", () => {
    const plan = planClientPacks(
      input({
        activeCodes: ["RHS"],
        endedCodes: [{ code: "HHS", endedOn: "2026-08-31" }],
        clientPacks: [pack("hhs_client"), pack("rhs_client")],
        items: [item("housemate_discussion"), item("medical_exam"), item("room_board_agreement")],
      }),
    );
    const retired = plan.retireItems.map((r) => r.id);
    assert.equal(retired.includes("item-housemate_discussion"), false);
    assert.equal(retired.includes("item-medical_exam"), false);
    assert.ok(retired.includes("item-room_board_agreement"));
  });

  it("brings a code pack and its rows back when the code returns", () => {
    const ended = "HHS ended Aug 31, 2026";
    const plan = planClientPacks(
      input({
        activeCodes: ["HHS"],
        clientPacks: [
          pack("client_core"),
          pack("hhs_client", { removed_at: "2026-09-01T00:00:00Z", removed_reason: ended }),
        ],
        items: [
          item("room_board_agreement", { opted_out_at: "2026-09-01", opt_out_reason: ended }),
        ],
      }),
    );
    assert.deepEqual(plan.addPacks, ["hhs_client"]);
    assert.deepEqual(plan.restoreItemIds, ["item-room_board_agreement"]);
  });

  it("never brings back a pack an admin removed, or a row a person waived", () => {
    const plan = planClientPacks(
      input({
        activeCodes: ["HHS"],
        clientPacks: [
          pack("client_core"),
          pack("hhs_client", { removed_at: "2026-09-01", removed_reason: PACK_REMOVED_BY_HAND }),
        ],
        items: [
          item("client_photo", { opted_out_at: "2026-09-01", opt_out_reason: "Person declined" }),
        ],
      }),
    );
    assert.deepEqual(plan.addPacks, []);
    assert.deepEqual(plan.restoreItemIds, []);
  });

  it("marks a removed pack's rows as pack removed, and keeps hand-added items", () => {
    const plan = planClientPacks(
      input({
        activeCodes: ["SEI"],
        clientPacks: [
          pack("sei_client", { removed_at: "2026-09-01", removed_reason: PACK_REMOVED_BY_HAND }),
        ],
        items: [item("employment_supports"), item("fba_on_file", { added_by_hand: true })],
      }),
    );
    assert.deepEqual(plan.retireItems, [
      { id: "item-employment_supports", reason: PACK_REMOVED_REASON },
    ]);
  });

  it("a hand-added pack doesn't end with codes", () => {
    const plan = planClientPacks(
      input({ activeCodes: [], clientPacks: [pack("sei_client", { origin: "hand" })] }),
    );
    assert.deepEqual(plan.endPacks, []);
    assert.deepEqual(plan.activePackKeys, ["client_core", "sei_client"]);
  });
});

describe("residential and guardian rules", () => {
  it("never gives housemate, room and board or lease rows without HHS, PPS or RHS", () => {
    const keys = requiredKeysFor(["hhs_client", "rhs_client", "pps_client"], ["SLH"], false);
    for (const k of [
      "housemate_discussion",
      "room_board_agreement",
      "room_board_agreement_pps",
      "lease_housing",
    ]) {
      assert.equal(keys.includes(k), false, k);
    }
    assert.ok(keys.includes("medical_exam"));
  });

  it("retires residential-only rows when the last residential code ends", () => {
    const plan = planClientPacks(
      input({
        activeCodes: ["SLH"],
        endedCodes: [{ code: "PPS", endedOn: "2026-07-15" }],
        clientPacks: [pack("pps_client", { origin: "hand" })],
        items: [item("room_board_agreement_pps"), item("medical_exam")],
      }),
    );
    assert.deepEqual(plan.retireItems, [
      { id: "item-room_board_agreement_pps", reason: "PPS ended Jul 15, 2026" },
    ]);
  });

  it("gives PPS and RHS the housemate discussion; PPS gets its own room and board", () => {
    assert.ok(requiredKeysFor(["rhs_client"], ["RHS"], false).includes("housemate_discussion"));
    const pps = requiredKeysFor(["pps_client"], ["PPS"], false);
    assert.ok(pps.includes("housemate_discussion"));
    assert.ok(pps.includes("room_board_agreement_pps"));
    assert.equal(pps.includes("room_board_agreement"), false);
  });

  it("skips guardian papers for a client who is their own guardian", () => {
    const plan = planClientPacks(
      input({
        ownGuardian: true,
        clientPacks: [pack("client_core")],
        items: [item("guardian_papers")],
      }),
    );
    assert.equal(plan.requiredKeys.includes("guardian_papers"), false);
    assert.deepEqual(plan.retireItems, [
      { id: "item-guardian_papers", reason: OWN_GUARDIAN_REASON },
    ]);
  });
});

describe("pack helpers", () => {
  it("knows which codes bring each pack", () => {
    assert.deepEqual(packTriggerCodes(clientPack("hhs_client")!), ["HHS"]);
    assert.deepEqual(packTriggerCodes(clientPack("pps_client")!), ["PPS"]);
    assert.deepEqual(packTriggerCodes(clientPack("client_core")!), []);
    assert.deepEqual(activeTriggers(clientPack("sei_client")!, ["SEE", "HHS"]), ["SEE"]);
  });

  it("only PI's own reasons are undone automatically", () => {
    assert.equal(isAutoReason(codeEndedReason("HHS", "2026-08-31")), true);
    assert.equal(isAutoReason(PACK_REMOVED_REASON), true);
    assert.equal(isAutoReason(NO_SERVICE_REASON), true);
    assert.equal(isAutoReason("Person declined"), false);
    assert.equal(isAutoReason(PACK_REMOVED_BY_HAND), false);
  });

  it("every client pack row is in the catalog", () => {
    for (const p of EVIDENCE_PACKS.filter((x) => x.subject === "client")) {
      assert.ok(p.requirementKeys.length > 0, p.key);
    }
  });
});
