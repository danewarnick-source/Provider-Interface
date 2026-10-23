// Mocked PCSP import server functions for e2e: readPcsp returns the made-up
// sample PCSP's parse (the same fixture the unit test checks exactly);
// confirmPcsp records that it was called.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proposeCarryOver } from "../../src/lib/clients/pcsp/carry-over";
import type { PcspResult } from "../../src/lib/clients/pcsp/parser-shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(here, "../../src/lib/clients/pcsp/fixture/sample-expected.json");

export const PCSP_DOCUMENT_ID = "00000000-0000-4000-a000-0000000005d1";
const CURRENT_GOAL = { id: "00000000-0000-4000-a000-0000000005c1", goal_text: "Pat will cook a simple meal each week." };

export const pcspCalls = { read: 0, confirm: 0 };

export function isPcspServerFn(blob: string): "readPcsp" | "confirmPcsp" | "" {
  if (/fileBase64/.test(blob)) return "readPcsp";
  if (/parseId/.test(blob) && /edits/.test(blob)) return "confirmPcsp";
  return "";
}

export function pcspServerFnPayload(fn: "readPcsp" | "confirmPcsp"): unknown {
  if (fn === "readPcsp") {
    pcspCalls.read++;
    const parse = JSON.parse(fs.readFileSync(SAMPLE, "utf8")) as PcspResult;
    return {
      documentId: PCSP_DOCUMENT_ID,
      fileName: "sample-pcsp.pdf",
      parse,
      carry: proposeCarryOver(parse.goals.map((g) => g.goal), [CURRENT_GOAL], parse.lastYearGoals),
      currentPlan: { id: "00000000-0000-4000-a000-0000000005b1", start_date: "2025-09-01", end_date: "2026-08-31" },
      nectarSections: [],
    };
  }
  pcspCalls.confirm++;
  return { planId: "00000000-0000-4000-a000-0000000005b2", goals: 2, supports: 5, codes: ["DSI", "HHS", "SEI"], contacts: 1 };
}
