// The state rules every agency's Nectar answers from (N5, Decisions 6 and 7).
// No runtime aliases, so node --test can import it.
//
// PI loads them once for every agency; team members and admins both see them.
// Only the current version of each rule: published and not archived.

import type { NectarDb } from "../engine/ask-types.ts";

export interface StateRuleDoc {
  id: string;
  title: string;
  version: number;
}

export async function loadStateRules(db: NectarDb): Promise<StateRuleDoc[]> {
  const { data, error } = await db
    .from("state_rule_documents")
    .select("id, title, version")
    .not("published_at", "is", null)
    .is("archived_at", null);
  if (error) throw new Error("Could not load the state rules.");
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, version: r.version }));
}
