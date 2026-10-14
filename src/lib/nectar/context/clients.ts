// Plan goals, must-knows and medication lists of the clients in the caller's
// scope, passed to the model as small labeled facts (N5, Decision 7). No
// runtime aliases, so node --test can import it.
//
// Scope comes from access, never from the request. Staff view: the caller's
// caseload from clients_for_staff (direct assignments and group-home mates;
// when that function refuses, as it does without a user token, the direct
// staff_assignments rows). Admin view (agency-wide admins only): every client
// of the agency. Facts are made only for the clients a question is about: the
// ones it names, or, for a team member's care question that names nobody,
// their caseload (up to 6).
//
// Goals and must-knows come from the Clients rebuild's tables when a client
// has them (client_goals of the current plan, client_must_knows), otherwise
// from clients.pcsp_goals and special_directions, which production still
// writes. Medications are the active rows of client_medications.

import type { NectarAskCaller, NectarDb, NectarFact } from "../engine/ask-types.ts";

export const MAX_NAMED_CLIENTS = 3;
export const MAX_STAFF_CARE_CLIENTS = 6;
const MAX_GOALS = 12;
const MAX_ITEM_CHARS = 240;
const MAX_MUST_KNOW_CHARS = 1_500;
const MAX_MEDS = 40;
const MAX_MED_LINE_CHARS = 400;

const CLIENT_COLUMNS = "id, organization_id, first_name, last_name, pcsp_goals, special_directions";

/** A care question about the people a team member supports. */
const CARE_TOPIC =
  /\b(goals?|pcsp|plans?|outcomes?|meds?|medications?|dose|doses|dosage|prn|pills?|must[- ]?knows?|directions?|allerg\w*|diet|choking|swallow\w*|seizures?|behaviou?rs?|safety|triggers?|routines?|my clients?|caseload|people i support)\b/i;

export interface ScopedClient {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  pcsp_goals: string[] | null;
  special_directions: string | null;
}

interface MedRow {
  client_id: string;
  medication_name: string;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  instructions: string | null;
  is_prn: boolean;
  prn_instructions: string | null;
  choking_risk: boolean;
  choking_risk_details: string | null;
  adverse_effects: string | null;
  paused_at: string | null;
}

interface GoalRow {
  client_id: string;
  plan_id: string;
  goal_text: string;
  kind: string;
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function clientName(c: Pick<ScopedClient, "first_name" | "last_name">): string {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
}

/** Clients whose first or last name the question uses as a word ("Avery", "Avery's"). */
export function clientsNamedIn(question: string, clients: readonly ScopedClient[]): ScopedClient[] {
  const tokens =
    question
      .toLowerCase()
      .replace(/’/g, "'")
      .match(/[a-z][a-z'-]*/g) ?? [];
  const words = new Set(tokens.flatMap((t) => [t, t.replace(/'s?$/, "")]));
  const named = (name: string | null) => {
    const n = (name ?? "").trim().toLowerCase();
    return n.length >= 2 && words.has(n);
  };
  return clients.filter((c) => named(c.first_name) || named(c.last_name));
}

/** The clients whose facts a question gets. Pure. */
export function clientsForQuestion(
  question: string,
  clients: readonly ScopedClient[],
  caller: Pick<NectarAskCaller, "view">,
): ScopedClient[] {
  const named = clientsNamedIn(question, clients);
  if (named.length) return named.slice(0, MAX_NAMED_CLIENTS);
  if (caller.view === "staff" && CARE_TOPIC.test(question)) {
    return clients.slice(0, MAX_STAFF_CARE_CLIENTS);
  }
  return [];
}

export function goalsFact(c: ScopedClient, goals: readonly GoalRow[]): NectarFact | null {
  const items = (
    goals.length
      ? goals.map((g) => (g.kind === "other_need" ? `Other need: ${g.goal_text}` : g.goal_text))
      : (c.pcsp_goals ?? [])
  )
    .map((g) => (g ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_GOALS)
    .map((g) => clip(g, MAX_ITEM_CHARS));
  if (!items.length) return null;
  return {
    id: `goals:${c.id}`,
    kind: "client_plan",
    title: `Plan goals for ${clientName(c)}`,
    heading: null,
    text: items.map((g, i) => `${i + 1}. ${g}`).join("\n"),
    clientId: c.id,
  };
}

export function mustKnowsFact(c: ScopedClient, approvedText: string | null): NectarFact | null {
  const text = approvedText?.trim() || c.special_directions?.trim() || "";
  if (!text) return null;
  return {
    id: `must-knows:${c.id}`,
    kind: "client_plan",
    title: `Must-knows for ${clientName(c)}`,
    heading: null,
    text: clip(text, MAX_MUST_KNOW_CHARS),
    clientId: c.id,
  };
}

function medLine(m: MedRow): string {
  const what = [m.medication_name, m.strength, m.dosage, m.frequency, m.route]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const notes = [
    m.is_prn
      ? `As needed (PRN)${m.prn_instructions ? `: ${m.prn_instructions.trim()}` : ""}`
      : null,
    m.instructions?.trim() ? `Instructions: ${m.instructions.trim()}` : null,
    m.choking_risk
      ? `Choking risk${m.choking_risk_details ? `: ${m.choking_risk_details.trim()}` : ""}`
      : null,
    m.adverse_effects?.trim() ? `Watch for: ${m.adverse_effects.trim()}` : null,
    m.paused_at ? "Paused" : null,
  ].filter((n): n is string => !!n);
  return clip(`- ${what}${notes.length ? `. ${notes.join(". ")}` : ""}`, MAX_MED_LINE_CHARS);
}

export function medicationsFact(c: ScopedClient, meds: readonly MedRow[]): NectarFact | null {
  if (!meds.length) return null;
  return {
    id: `meds:${c.id}`,
    kind: "medications",
    title: `Current medications for ${clientName(c)}`,
    heading: null,
    text: meds.slice(0, MAX_MEDS).map(medLine).join("\n"),
    clientId: c.id,
  };
}

/** The caller's clients: caseload (staff view) or the whole agency (agency-wide admins). */
export async function loadClientScope(
  db: NectarDb,
  caller: NectarAskCaller,
): Promise<ScopedClient[]> {
  let rows: ScopedClient[];
  if (caller.view === "admin" && caller.agencyAdmin) {
    const { data, error } = await db
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("organization_id", caller.orgId)
      .order("last_name");
    if (error) throw new Error("Could not load your clients.");
    rows = data ?? [];
  } else {
    const caseload = await db.rpc("clients_for_staff", {
      _org: caller.orgId,
      _staff: caller.userId,
    });
    if (!caseload.error) {
      rows = (caseload.data ?? []) as ScopedClient[];
    } else {
      const { data: assigned, error } = await db
        .from("staff_assignments")
        .select("client_id")
        .eq("organization_id", caller.orgId)
        .eq("staff_id", caller.userId);
      if (error) throw new Error("Could not load your caseload.");
      const ids = [...new Set((assigned ?? []).map((a) => a.client_id))];
      if (!ids.length) return [];
      const { data, error: clientsError } = await db
        .from("clients")
        .select(CLIENT_COLUMNS)
        .eq("organization_id", caller.orgId)
        .in("id", ids);
      if (clientsError) throw new Error("Could not load your caseload.");
      rows = data ?? [];
    }
  }
  return rows.filter((r) => r.organization_id === caller.orgId);
}

async function loadCareRows(db: NectarDb, orgId: string, ids: string[]) {
  const [meds, plans, goals, mustKnows] = await Promise.all([
    db
      .from("client_medications")
      .select(
        "client_id, medication_name, strength, dosage, frequency, route, instructions, is_prn, prn_instructions, choking_risk, choking_risk_details, adverse_effects, paused_at",
      )
      .eq("organization_id", orgId)
      .in("client_id", ids)
      .eq("is_active", true)
      .is("discontinued_at", null)
      .order("medication_name"),
    db
      .from("client_plans")
      .select("id, client_id")
      .eq("organization_id", orgId)
      .in("client_id", ids)
      .eq("status", "current"),
    db
      .from("client_goals")
      .select("client_id, plan_id, goal_text, kind, sort")
      .eq("organization_id", orgId)
      .in("client_id", ids)
      .eq("status", "active")
      .order("sort"),
    db
      .from("client_must_knows")
      .select("client_id, approved_text")
      .eq("organization_id", orgId)
      .in("client_id", ids),
  ]);
  if (meds.error) throw new Error("Could not load medication lists.");
  // The Clients rebuild's tables are optional: without them the older columns are used.
  const current = new Set((plans.error ? [] : (plans.data ?? [])).map((p) => p.id));
  return {
    meds: (meds.data ?? []) as MedRow[],
    goals: (goals.error ? [] : (goals.data ?? [])).filter((g) =>
      current.has(g.plan_id),
    ) as GoalRow[],
    mustKnows: mustKnows.error ? [] : (mustKnows.data ?? []),
  };
}

/** The caller's client scope, and facts for the clients this question is about. */
export async function loadClientFacts(
  db: NectarDb,
  caller: NectarAskCaller,
  question: string,
): Promise<{ scope: ScopedClient[]; facts: NectarFact[] }> {
  const scope = await loadClientScope(db, caller);
  const picked = clientsForQuestion(question, scope, caller);
  if (!picked.length) return { scope, facts: [] };
  const rows = await loadCareRows(
    db,
    caller.orgId,
    picked.map((c) => c.id),
  );
  const facts = picked.flatMap((c) =>
    [
      goalsFact(
        c,
        rows.goals.filter((g) => g.client_id === c.id),
      ),
      mustKnowsFact(c, rows.mustKnows.find((m) => m.client_id === c.id)?.approved_text ?? null),
      medicationsFact(
        c,
        rows.meds.filter((m) => m.client_id === c.id),
      ),
    ].filter((f): f is NectarFact => f !== null),
  );
  return { scope, facts };
}
