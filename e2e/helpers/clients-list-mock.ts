// Mocked client list + Add client server functions (src/lib/clients/list.functions.ts,
// create.functions.ts). Rows are built from the made-up roster fixture; search
// and filters run here the way the server does, so the page's one request per
// change can be counted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLIENT_LIST, TEAMS } from "../fixtures/tns-roster";
import {
  applyListFilters,
  listReadiness,
  searchTerms,
  sortRows,
  type ClientListRow,
} from "../../src/lib/clients/list";

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(here, "../../src/lib/clients/pcsp/fixture/sample-expected.json");

export const NEW_CLIENT_ID = "00000000-0000-4000-a000-0000000000c2";

export const clientListCalls = { list: 0, add: 0, bodies: [] as string[] };

export type ClientListMockOpts = { emptyClients?: boolean };

type SerovalNode = {
  t?: number;
  s?: unknown;
  p?: { k?: string[]; v?: SerovalNode[] };
  a?: SerovalNode[];
};

function decode(n: SerovalNode | undefined): unknown {
  if (!n) return null;
  if (n.t === 1 || n.t === 0) return n.s;
  if (n.t === 2) return n.s === 2 ? true : n.s === 3 ? false : null;
  return null;
}

function findKey(n: unknown, key: string): unknown {
  if (!n || typeof n !== "object") return undefined;
  const node = n as SerovalNode;
  const i = node.p?.k?.indexOf(key) ?? -1;
  if (i >= 0) return decode(node.p!.v![i]);
  for (const child of Object.values(node)) {
    const hit = Array.isArray(child)
      ? child.map((c) => findKey(c, key)).find((v) => v !== undefined)
      : findKey(child, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** A field of the server-fn input (seroval-encoded POST body, or ?payload= on GET). */
function field(body: string, key: string): string | null {
  let raw = body;
  const q = body.match(/[?&]payload=([^&]*)/);
  if (q) raw = decodeURIComponent(q[1]);
  try {
    const v = findKey(JSON.parse(raw), key);
    return typeof v === "string" ? v : v === true ? "true" : null;
  } catch {
    return null;
  }
}

function rows(opts: ClientListMockOpts): ClientListRow[] {
  if (opts.emptyClients) return [];
  return CLIENT_LIST.map((c) => {
    const team = TEAMS.find((t) => t.id === c.team_id);
    const codes = [...c.codes];
    const row: ClientListRow = {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      preferred_name: null,
      photo_url: null,
      medicaid_id: c.medicaid_id,
      client_pid: null,
      account_status: "active",
      codes,
      endedCodes: null,
      planExpired: false,
      home: team ? { id: team.id, name: team.team_name } : null,
      unitsLeft: codes.length ? { code: codes[0], left: 800, annual: 1000, pct: 80 } : null,
      needsUnits: false,
      nextDue: codes.length
        ? { kind: "summary", label: "Summary due", date: "2027-01-15", days: 90 }
        : null,
      staff: [],
      readiness: listReadiness({
        codes,
        staffCount: codes.length ? 1 : 0,
        hasPin: true,
        guardianGap: null,
      }),
    };
    return row;
  });
}

export function listClientsPayload(body: string, opts: ClientListMockOpts) {
  clientListCalls.list++;
  clientListCalls.bodies.push(body);
  const view = field(body, "view") ?? "active";
  const terms = searchTerms(field(body, "search") ?? "");
  const all = view === "discharged" ? [] : rows(opts);
  const matched = all.filter((r) =>
    terms.every((t) =>
      `${r.first_name} ${r.last_name} ${r.medicaid_id ?? ""}`.toLowerCase().includes(t),
    ),
  );
  const filters = {
    code: field(body, "code"),
    homeId: field(body, "homeId"),
    staffId: field(body, "staffId"),
  };
  return {
    rows: sortRows(applyListFilters(matched, filters)),
    counts: { active: rows(opts).length, discharged: 0 },
    homes: TEAMS.map((t) => ({ id: t.id, name: t.team_name })),
    staffOptions: [],
    codeOptions: [...new Set(matched.flatMap((r) => r.codes))].sort(),
    hasReferrals: false,
  };
}

function duplicateOf(body: string): { id: string; name: string } | null {
  const id = (field(body, "medicaidId") ?? field(body, "medicaid_id") ?? "").trim().toUpperCase();
  const hit = CLIENT_LIST.find((c) => c.medicaid_id.toUpperCase() === id);
  return hit ? { id: hit.id, name: `${hit.first_name} ${hit.last_name}` } : null;
}

/** Payload for the Add client server functions, or undefined when `fn` isn't one. */
export function addClientPayload(fn: string, body: string): unknown {
  if (/^findClientsByMedicaidIds/.test(fn)) {
    return CLIENT_LIST.filter((c) => c.medicaid_id && body.includes(c.medicaid_id)).map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      medicaidId: c.medicaid_id,
    }));
  }
  if (/^readPcspForNewClient/.test(fn)) return JSON.parse(fs.readFileSync(SAMPLE, "utf8"));
  if (/^addClient/.test(fn)) {
    clientListCalls.add++;
    const existing = duplicateOf(body);
    return existing
      ? { status: "duplicate", existing }
      : { status: "created", id: NEW_CLIENT_ID, pinFound: true };
  }
  return undefined;
}
