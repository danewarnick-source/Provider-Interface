import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BELONGINGS_CODES,
  CLIENT_FILE_CARD_KEYS,
  CLIENT_FILE_CARD_TITLE,
  FUNDS_CODES,
  HOUSEMATE_CODES,
  LEASE_CODES,
  RNB_CODES,
  buildClientFileCards,
  cardApplies,
  clientFileStatus,
  clientFileStatusLabel,
  photoExpiresOn,
  type ClientFileFacts,
} from "./file.ts";
import { missingClientFileCsv } from "./file-csv.ts";

const now = new Date("2026-09-10T12:00:00.000Z");

function facts(overrides: Partial<ClientFileFacts> = {}): ClientFileFacts {
  return {
    codes: ["HHS", "DSI"],
    photoPath: null,
    photoTakenOn: null,
    isOwnGuardian: true,
    grievanceOk: false,
    planEndDate: null,
    docs: [],
    belongingsOn: null,
    strategies: { kind: "no_activation", hasPlan: false },
    housemateOnFile: false,
    housemateDueAt: null,
    summaries: [],
    hasPbaAccount: false,
    ...overrides,
  };
}

describe("clientFileStatus", () => {
  it("uses only On file / Due soon / Missing", () => {
    assert.equal(clientFileStatusLabel("on_file"), "On file");
    assert.equal(clientFileStatusLabel("due_soon"), "Due soon");
    assert.equal(clientFileStatusLabel("missing"), "Missing");
    assert.notEqual(clientFileStatusLabel("on_file"), "Have");
  });

  it("marks a current artifact On file", () => {
    assert.equal(clientFileStatus({ onFile: true, now }), "on_file");
  });

  it("marks a renewal window Due soon on the same card", () => {
    assert.equal(
      clientFileStatus({ onFile: true, dueAt: "2026-09-14T12:00:00.000Z", now }),
      "due_soon",
    );
  });

  it("marks expired or absent as Missing", () => {
    assert.equal(
      clientFileStatus({ onFile: true, dueAt: "2026-09-01T00:00:00.000Z", now }),
      "missing",
    );
    assert.equal(clientFileStatus({ onFile: false, now }), "missing");
  });
});

describe("cardApplies", () => {
  it("gates belongings, housemate, lease/R&B, and money/funds", () => {
    assert.equal(cardApplies("belongings", ["HHS"]), true);
    assert.equal(cardApplies("belongings", ["SEI"]), false);
    assert.equal(cardApplies("housemate", ["RHS"]), true);
    assert.equal(cardApplies("housemate", ["SEI"]), false);
    assert.equal(cardApplies("lease_rb", ["HHS"]), true);
    assert.equal(cardApplies("lease_rb", ["RHS"]), true);
    assert.equal(cardApplies("lease_rb", ["SEI"]), false);
    assert.equal(cardApplies("money_funds", ["PBA"]), true);
    assert.equal(cardApplies("money_funds", ["HHS"]), false);
  });

  it("omits Support Strategies for excluded codes only", () => {
    assert.equal(cardApplies("support_strategies", ["HHS"]), true);
    assert.equal(cardApplies("support_strategies", ["PBA"]), false);
  });

  it("keeps the locked gate sets", () => {
    assert.deepEqual([...BELONGINGS_CODES].sort(), ["HHS", "PPS", "RHS", "SLH"]);
    assert.deepEqual([...HOUSEMATE_CODES].sort(), ["HHS", "PPS", "RHS"]);
    assert.deepEqual([...RNB_CODES].sort(), ["HHS", "PPS"]);
    assert.deepEqual([...LEASE_CODES].sort(), ["RHS"]);
    assert.deepEqual([...FUNDS_CODES].sort(), ["PBA"]);
  });
});

describe("buildClientFileCards", () => {
  it("emits the locked titles and never a rights-restriction card", () => {
    const cards = buildClientFileCards("c1", facts({ codes: ["HHS", "PBA"] }), now);
    const titles = cards.map((c) => c.title);
    assert.deepEqual(
      CLIENT_FILE_CARD_KEYS.map((k) => CLIENT_FILE_CARD_TITLE[k]).slice(0, 6),
      [
        "Photograph",
        "PCSP / planning documents",
        "Grievance receipt",
        "Support Strategies",
        "Service summary",
        "Client clinical/legal file area",
      ],
    );
    assert.ok(titles.includes("Photograph"));
    assert.ok(titles.includes("Belongings inventory"));
    assert.ok(titles.includes("Lease/R&B"));
    assert.ok(titles.includes("Money/funds"));
    assert.ok(!titles.some((t) => /rights restriction/i.test(t)));
  });

  it("scores Support Strategies from the send rule only (a BSP upload no longer counts)", () => {
    const card = (f: Partial<ClientFileFacts>) =>
      buildClientFileCards("c1", facts(f), now).find((c) => c.key === "support_strategies");
    const bsp = [{ document_type: "bsp", storage_path: "org/bsp.pdf", file_name: "bsp.pdf" }];
    assert.equal(card({ docs: bsp })?.status, "missing");
    const sent = card({
      docs: [{ document_type: "support_strategy", storage_path: "org/ss.pdf", file_name: "ss.pdf" }],
      strategies: { kind: "sent", sendId: "s1", sentOn: "2026-09-01", sentTo: null, by: null, late: false },
    });
    assert.equal(sent?.status, "on_file");
    assert.equal(sent?.evidencePath, "org/ss.pdf");
    const waiting = card({
      strategies: { kind: "not_sent", dueOn: "2026-09-12", dueSoon: true, overdue: false },
    });
    assert.equal(waiting?.status, "due_soon");
    assert.equal(waiting?.dueAt, "2026-09-12");
  });

  it("renews PCSP on the same card when expiration is due soon", () => {
    const cards = buildClientFileCards(
      "c1",
      facts({
        docs: [{ document_type: "pcsp", storage_path: "org/pcsp.pdf", file_name: "pcsp.pdf" }],
        planEndDate: "2026-09-14",
      }),
      now,
    );
    const pcsp = cards.find((c) => c.key === "pcsp");
    assert.ok(pcsp);
    assert.equal(pcsp.status, "due_soon");
    assert.equal(pcsp.title, "PCSP / planning documents");
  });

  it("scores photograph from the existing photo path", () => {
    const missing = buildClientFileCards("c1", facts(), now).find((c) => c.key === "photograph");
    const onFile = buildClientFileCards("c1", facts({ photoPath: "org/photo.jpg" }), now).find(
      (c) => c.key === "photograph",
    );
    assert.equal(missing?.status, "missing");
    assert.equal(onFile?.status, "on_file");
  });

  it("expires the photo 5 years after it was taken", () => {
    assert.equal(photoExpiresOn("2021-09-12"), "2026-09-12");
    assert.equal(photoExpiresOn(null), null);
    const card = (takenOn: string) =>
      buildClientFileCards("c1", facts({ photoPath: "org/p.jpg", photoTakenOn: takenOn }), now).find(
        (c) => c.key === "photograph",
      );
    assert.equal(card("2021-09-12")?.status, "due_soon");
    assert.equal(card("2021-09-12")?.dueAt, "2026-09-12");
    assert.equal(card("2021-01-01")?.status, "missing");
    assert.equal(card("2024-01-01")?.status, "on_file");
  });

  it("needs medical and dental exams only for RHS, PPS, HHS and SLH", () => {
    const clinical = (codes: string[]) =>
      buildClientFileCards("c1", facts({ codes }), now).find((c) => c.key === "clinical_legal");
    for (const code of ["RHS", "PPS", "HHS", "SLH"]) assert.equal(clinical([code])?.status, "missing", code);
    for (const code of ["SLN", "DSI", "SEI"]) assert.equal(clinical([code])?.status, "on_file", code);
    const withExams = buildClientFileCards(
      "c1",
      facts({ codes: ["HHS"], docs: [{ document_type: "medical_exam" }, { document_type: "dental_exam" }] }),
      now,
    ).find((c) => c.key === "clinical_legal");
    assert.equal(withExams?.status, "on_file");
  });

  it("keeps belongings on file with no yearly renewal, for HHS, PPS, RHS and SLH only", () => {
    for (const code of ["HHS", "PPS", "RHS", "SLH"]) assert.equal(cardApplies("belongings", [code]), true, code);
    assert.equal(cardApplies("belongings", ["SLN"]), false);
    const card = buildClientFileCards("c1", facts({ codes: ["PPS"], belongingsOn: "2020-01-01" }), now).find(
      (c) => c.key === "belongings",
    );
    assert.equal(card?.status, "on_file");
    assert.equal(card?.dueAt, null);
  });
});

describe("missingClientFileCsv", () => {
  it("exports missing items without inventing Have", () => {
    const csv = missingClientFileCsv([
      {
        full_name: "Alex Rivera",
        service_codes: ["HHS"],
        missing: 1,
        due_soon: 0,
        on_file: 4,
        missing_items: [{ title: "Photograph", due_at: null }],
      },
    ]);
    assert.match(csv, /Alex Rivera/);
    assert.match(csv, /Photograph/);
    assert.doesNotMatch(csv, /Have/);
  });
});

describe("Client file surface lock", () => {
  it("renames the client profile tab and adds an Admin sidebar route", () => {
    const profile = ["./profile-sections.ts", "../../components/clients/profile/sections/file-section.tsx"]
      .map((rel) => readFileSync(new URL(rel, import.meta.url), "utf8"))
      .join("\n");
    assert.match(profile, /Client file/);
    assert.match(profile, /ClientFileDocuments/);
    assert.doesNotMatch(profile, /RequiredDocumentsCard/);
    assert.doesNotMatch(profile, /PersonCenteredProfilePanel/);
    assert.doesNotMatch(profile, /<CardTitle className="text-base">Person-Centered Thinking<\/CardTitle>/);
    assert.doesNotMatch(profile, /<TabsTrigger value="files">Files<\/TabsTrigger>/);
    assert.ok(!CLIENT_FILE_CARD_KEYS.includes("rights" as (typeof CLIENT_FILE_CARD_KEYS)[number]));
    assert.ok(!Object.values(CLIENT_FILE_CARD_TITLE).some((t) => /rights/i.test(t)));

    const nav = readFileSync(new URL("../../routes/dashboard.tsx", import.meta.url), "utf8");
    assert.match(nav, /to: "\/dashboard\/evidence", label: "Evidence"/);
    assert.doesNotMatch(nav, /to: "\/dashboard\/client-file", label: "Client file"/);

    const route = readFileSync(new URL("../../routes/dashboard.client-file.tsx", import.meta.url), "utf8");
    assert.match(route, /createFileRoute\("\/dashboard\/client-file"\)/);
    assert.match(route, /redirect/);
    assert.match(route, /\/dashboard\/compliance/);
    const panel = readFileSync(
      new URL("../../components/compliance/client-file-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(panel, /Client file/);
    assert.match(panel, /OrgClientFileMatrix/);
    assert.doesNotMatch(panel, /EVV/);
    assert.doesNotMatch(panel, /HRC/);
  });

  it("does not add a fourth audit product", () => {
    const matrix = readFileSync(
      new URL("../../components/client-file/org-client-file-matrix.tsx", import.meta.url),
      "utf8",
    );
    assert.match(matrix, /\/dashboard\/internal-audit/);
    assert.doesNotMatch(matrix, /Client Audit/);
    assert.doesNotMatch(matrix, /Practice Audit System/);
  });
});
