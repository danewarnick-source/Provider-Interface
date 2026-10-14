// Test support for the engine tests (N5): one made-up agency, a stand-in for
// nectar_search_sections and a mocked Bedrock. Every name, document and
// medication here is invented; none is real data.

import type { NectarAskCaller } from "./ask-types.ts";
import { FakeDb, type Row, type RpcHandler } from "./fake-db.ts";

export const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const STAFF = "11111111-1111-4111-8111-111111111111";
export const OTHER_STAFF = "22222222-2222-4222-8222-222222222222";
export const OWNER = "33333333-3333-4333-8333-333333333333";

export const DOC = {
  forAll: "d0000000-0000-4000-8000-000000000001",
  forOther: "d0000000-0000-4000-8000-000000000002",
  draft: "d0000000-0000-4000-8000-000000000003",
  contract: "d0000000-0000-4000-8000-000000000004",
  archived: "d0000000-0000-4000-8000-000000000005",
};
export const RULE = "e0000000-0000-4000-8000-000000000001";
export const CLIENT = {
  assigned: "c0000000-0000-4000-8000-000000000001",
  unassigned: "c0000000-0000-4000-8000-000000000002",
};
export const SECTION = {
  forAll: "f0000000-0000-4000-8000-000000000001",
  forOther: "f0000000-0000-4000-8000-000000000002",
  draft: "f0000000-0000-4000-8000-000000000003",
  contract: "f0000000-0000-4000-8000-000000000004",
  rule: "f0000000-0000-4000-8000-000000000005",
  archived: "f0000000-0000-4000-8000-000000000006",
};

export const staffCaller: NectarAskCaller = {
  userId: STAFF,
  orgId: ORG,
  view: "staff",
  agencyAdmin: false,
};
export const adminCaller: NectarAskCaller = {
  userId: OWNER,
  orgId: ORG,
  view: "admin",
  agencyAdmin: true,
};

function doc(id: string, title: string, extra: Row = {}): Row {
  return {
    id,
    organization_id: ORG,
    owner_kind: "company",
    title,
    version: 1,
    library_group: "agency",
    library_status: "published",
    superseded_by: null,
    archived_at: null,
    audience_all: true,
    policy_assigned_users: [],
    document_type: "policy",
    authoritative_kind: "provider_policy",
    required_slot: null,
    review_due: "2027-10-01",
    ...extra,
  };
}

function section(id: string, extra: Row): Row {
  return {
    id,
    organization_id: ORG,
    document_id: null,
    state_document_id: null,
    client_id: null,
    version: 1,
    retired_at: null,
    ...extra,
  };
}

function med(clientId: string, name: string): Row {
  return {
    client_id: clientId,
    organization_id: ORG,
    medication_name: name,
    strength: "10 mg",
    dosage: "1 tablet",
    frequency: "twice a day",
    route: "by mouth",
    instructions: "Give with food.",
    is_prn: false,
    prn_instructions: null,
    choking_risk: false,
    choking_risk_details: null,
    adverse_effects: null,
    paused_at: null,
    is_active: true,
    discontinued_at: null,
  };
}

export function agencyTables(): Record<string, Row[]> {
  return {
    nectar_documents: [
      doc(DOC.forAll, "Medication Policy", { required_slot: "health_medication" }),
      doc(DOC.forOther, "Overnight Checks Procedure", {
        library_group: "procedures",
        audience_all: false,
        policy_assigned_users: [OTHER_STAFF],
      }),
      doc(DOC.draft, "Visitor Policy", { library_status: "draft" }),
      doc(DOC.contract, "Signed Provider Contract", {
        library_group: "reference",
        document_type: "contract",
        authoritative_kind: "provider_contract",
      }),
      doc(DOC.archived, "Old Fire Drill Policy", {
        library_status: "archived",
        archived_at: "2026-09-01T00:00:00.000Z",
      }),
    ],
    state_rule_documents: [
      {
        id: RULE,
        title: "DHHS91172 Scope of Work",
        version: 1,
        published_at: "2026-07-01T00:00:00.000Z",
        archived_at: null,
      },
    ],
    knowledge_sections: [
      section(SECTION.forAll, {
        document_id: DOC.forAll,
        heading: "4.2 Missed doses",
        body: "If a dose is missed, call the nurse and write it in the medication log.",
      }),
      section(SECTION.forOther, {
        document_id: DOC.forOther,
        heading: "Overnight checks",
        body: "Check on each person every two hours overnight and initial the overnight log.",
      }),
      section(SECTION.draft, {
        document_id: DOC.draft,
        heading: "Visitors",
        body: "Visitors sign the visitor book at the front door.",
      }),
      section(SECTION.contract, {
        document_id: DOC.contract,
        heading: "Payment terms",
        body: "The state pays the provider within thirty days of each claim.",
      }),
      section(SECTION.rule, {
        organization_id: null,
        state_document_id: RULE,
        heading: "1.18(3) Grievances",
        body: "The provider keeps a written grievance policy and gives every person a copy.",
      }),
      section(SECTION.archived, {
        document_id: DOC.archived,
        heading: "Fire drills",
        body: "Hold a fire drill once a year.",
        retired_at: "2026-09-01T00:00:00.000Z",
      }),
    ],
    organizations: [
      {
        id: ORG,
        name: "Sample Supports",
        provides_transportation: true,
        manages_client_money: false,
      },
    ],
    profiles: [
      { id: STAFF, full_name: "Sam Staff", email: "sam@example.test" },
      { id: OWNER, full_name: "Olive Owner", email: "olive@example.test" },
    ],
    organization_members: [
      { organization_id: ORG, user_id: STAFF, active: true },
      { organization_id: ORG, user_id: OTHER_STAFF, active: true },
      { organization_id: ORG, user_id: OWNER, active: true },
    ],
    clients: [
      {
        id: CLIENT.assigned,
        organization_id: ORG,
        first_name: "Avery",
        last_name: "Assigned",
        pcsp_goals: ["Walk to the park twice a week"],
        special_directions: "Cut food into small pieces.",
        account_status: "active",
      },
      {
        id: CLIENT.unassigned,
        organization_id: ORG,
        first_name: "Umber",
        last_name: "Unassigned",
        pcsp_goals: ["Cook dinner once a week"],
        special_directions: "Keep the kitchen door closed.",
        account_status: "active",
      },
    ],
    client_medications: [med(CLIENT.assigned, "Examplol"), med(CLIENT.unassigned, "Samplazine")],
    staff_assignments: [{ organization_id: ORG, staff_id: STAFF, client_id: CLIENT.assigned }],
    required_policy_slots: [
      {
        id: "health_medication",
        code: "1.23",
        label: "Health and medication",
        applies_when: null,
        position: 10,
      },
      { id: "grievances", code: "1.18(3)", label: "Grievances", applies_when: null, position: 5 },
    ],
    policy_signatures: [],
    nectar_questions: [],
  };
}

/** Like the SQL function: allowed ids only, not retired, any shared word ranks. */
export function fakeSearch(db: FakeDb, opts: { ignoreScope?: boolean } = {}): RpcHandler {
  return (args) => {
    const ids = (k: string) => (args[k] as string[] | undefined) ?? [];
    const words =
      String(args.p_query ?? "")
        .toLowerCase()
        .match(/[a-z]{4,}/g) ?? [];
    const allowed = (s: Row) =>
      s.state_document_id
        ? ids("p_state_document_ids").includes(s.state_document_id as string)
        : s.organization_id === args.p_organization_id &&
          (s.client_id
            ? ids("p_client_ids").includes(s.client_id as string)
            : ids("p_document_ids").includes(s.document_id as string));
    const hits = (db.tables.knowledge_sections ?? [])
      .filter((s) => !s.retired_at && (opts.ignoreScope || allowed(s)))
      .map((s) => {
        const hay = `${s.heading} ${s.body}`.toLowerCase();
        const n = words.filter((w) => hay.includes(w.slice(0, 5))).length;
        return { ...s, text_rank: n ? n / 10 : null, vector_similarity: null };
      })
      .filter((h) => h.text_rank !== null);
    return { data: hits, error: null };
  };
}

/** Assigned clients of a staff member, like clients_for_staff. */
export const fakeCaseload: (db: FakeDb) => RpcHandler = (db) => (args) => ({
  data: (db.tables.clients ?? []).filter((c) =>
    (db.tables.staff_assignments ?? []).some(
      (a) => a.staff_id === args._staff && a.client_id === c.id && a.organization_id === args._org,
    ),
  ),
  error: null,
});

export function agencyDb(opts: { ignoreScope?: boolean; failing?: string[] } = {}): FakeDb {
  const db = new FakeDb({ tables: agencyTables(), failing: opts.failing });
  return db
    .onRpc("nectar_search_sections", fakeSearch(db, opts))
    .onRpc("clients_for_staff", fakeCaseload(db));
}

/** The id the prompt gave the source whose text contains `needle`. */
export function labelFor(system: string, needle: string): string | null {
  const blocks = system.matchAll(
    /Source \[S:(s\d+)\][^\n]*\n<<<UNTRUSTED_DOCUMENT>>>\n([\s\S]*?)<<<END_UNTRUSTED_DOCUMENT>>>/g,
  );
  for (const [, label, body] of blocks) if (body!.includes(needle)) return label!;
  return null;
}

/** A mocked Bedrock: records every call; the model replies with `reply(system, user)`. */
export function mockBedrock(reply: (system: string, user: string) => string = () => "") {
  const calls = { model: [] as Array<{ system: string; user: string }>, embed: [] as string[] };
  return {
    calls,
    embed: async (text: string) => {
      calls.embed.push(text);
      return null;
    },
    model: async (system: string, user: string) => {
      calls.model.push({ system, user });
      return reply(system, user);
    },
  };
}
