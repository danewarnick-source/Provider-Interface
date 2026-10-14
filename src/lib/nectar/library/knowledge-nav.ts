// Where the Knowledge base opens (N4): its search params and the links other
// screens use (N6: source chips, "Add to library"). Pure: no Supabase, no
// aliases, so node --test can import it.
//
//   /dashboard/hub/knowledge                         Library tab
//   ?tab=required | ?tab=reviews                     the other tabs
//   ?doc=<nectar_documents id>                       a library document (any version)
//   ?rule=<state_rule_documents id>                  a state rule, read-only
//   ?new=true[&slot=<slot id>][&question=<id>]       New document, prefilled from a
//                                                    required slot or a question
//                                                    (saving it resolves the question)

export const KNOWLEDGE_PATH = "/dashboard/hub/knowledge";

export const KNOWLEDGE_TABS = ["library", "required", "reviews"] as const;
export type KnowledgeTab = (typeof KNOWLEDGE_TABS)[number];

export interface KnowledgeSearch {
  tab?: KnowledgeTab;
  doc?: string;
  rule?: string;
  new?: boolean;
  slot?: string;
  question?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLOT_ID = /^[a-z0-9_]{1,60}$/;

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

/** The route's search params. Anything unknown (old tabs like ?tab=sources) is dropped. */
export function parseKnowledgeSearch(raw: Record<string, unknown>): KnowledgeSearch {
  const out: KnowledgeSearch = {};
  const tab = text(raw.tab);
  if (tab && (KNOWLEDGE_TABS as readonly string[]).includes(tab)) out.tab = tab as KnowledgeTab;
  const doc = text(raw.doc);
  if (doc && UUID.test(doc)) out.doc = doc;
  const rule = text(raw.rule);
  if (rule && UUID.test(rule)) out.rule = rule;
  if ([true, "true", 1, "1"].includes(raw.new as never)) {
    out.new = true;
    const slot = text(raw.slot);
    if (slot && SLOT_ID.test(slot)) out.slot = slot;
    const question = text(raw.question);
    if (question && UUID.test(question)) out.question = question;
  }
  return out;
}

/** A link to the Knowledge base for these search params. */
export function knowledgeHref(search: KnowledgeSearch = {}): string {
  const params = new URLSearchParams();
  if (search.tab && search.tab !== "library") params.set("tab", search.tab);
  if (search.doc) params.set("doc", search.doc);
  if (search.rule) params.set("rule", search.rule);
  if (search.new) {
    params.set("new", "true");
    if (search.slot) params.set("slot", search.slot);
    if (search.question) params.set("question", search.question);
  }
  const qs = params.toString();
  return qs ? `${KNOWLEDGE_PATH}?${qs}` : KNOWLEDGE_PATH;
}

/** The page the search params open. */
export type KnowledgeView =
  | { kind: "new"; slot?: string; question?: string }
  | { kind: "document"; id: string }
  | { kind: "state_rule"; id: string }
  | { kind: "tabs"; tab: KnowledgeTab };

export function knowledgeView(search: KnowledgeSearch): KnowledgeView {
  if (search.new) return { kind: "new", slot: search.slot, question: search.question };
  if (search.doc) return { kind: "document", id: search.doc };
  if (search.rule) return { kind: "state_rule", id: search.rule };
  return { kind: "tabs", tab: search.tab ?? "library" };
}
