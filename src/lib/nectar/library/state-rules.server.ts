// State rules for hive executives (N4, Decision 6): list them, hand out an
// upload URL, publish a new version, and put a version in Nectar search.
// Runs on the executive's own data client: RLS lets only hive executives add
// or change state rules, their sections and their files. State rules belong
// to no agency, so embeddings count against the account-wide rate limit only.
// Nothing is deleted: a replaced version is archived and its sections flagged.
// Logs carry ids only, never rule text.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { NectarContext } from "@/lib/nectar/engine/guard.server";
import { embedPendingSections, indexStateRuleVersion, retireSections } from "./index.server";
import {
  isStateRulePath,
  planStateRuleVersion,
  searchProgress,
  STATE_RULE_EMBED_BUDGET_MS,
  STATE_RULE_NO_TEXT,
  STATE_RULES_BUCKET,
  stateRuleFileProblem,
  stateRuleObjectPath,
  type CurrentRule,
  type PublishStateRuleInput,
} from "./state-rules";
import { extractLibraryText, readStoredFile } from "./text.server";

type Db = SupabaseClient<Database>;
export type ExecCaller = { db: Db; userId: string };

export const STATE_RULES_SIGNED_OUT = "Sign in to manage state rules.";
export const STATE_RULES_EXEC_ONLY = "Only PI executives can change state rules.";
const NOT_FOUND = "State rule not found.";

/** Signed in, and an active hive executive (checked on the server, not by the screen). */
export async function requireHiveExecutive(context: NectarContext): Promise<ExecCaller> {
  const { supabase, userId } = context;
  if (!supabase || !userId) throw new Error(STATE_RULES_SIGNED_OUT);
  const { data, error } = await supabase.rpc("is_hive_executive", { _user: userId });
  if (error || data !== true) throw new Error(STATE_RULES_EXEC_ONLY);
  return { db: supabase, userId };
}

const RULE_COLUMNS =
  "id, rule_key, title, version, effective_from, published_at, archived_at, file_name, created_at" as const;
const INDEX_COLUMNS =
  "id, version, title, raw_text, storage_bucket, storage_path, file_name" as const;

/** How much of a version is in Nectar search (current sections, and those with an embedding). */
async function sectionCounts(db: Db, stateDocumentId: string) {
  const live = () =>
    db
      .from("knowledge_sections")
      .select("id", { count: "exact", head: true })
      .eq("state_document_id", stateDocumentId)
      .is("retired_at", null);
  const [all, embedded] = await Promise.all([live(), live().not("embedding", "is", null)]);
  return searchProgress(all.count ?? 0, embedded.count ?? 0);
}

/** Every rule's current version, its older versions, and how much of it is in search. */
export async function readStateRules({ db }: ExecCaller) {
  const { data, error } = await db
    .from("state_rule_documents")
    .select(RULE_COLUMNS)
    .order("rule_key")
    .order("version", { ascending: false });
  if (error) throw new Error("Could not load the state rules.");
  const rows = data ?? [];
  return Promise.all(
    rows
      .filter((r) => !r.archived_at)
      .map(async (r) => ({
        ...r,
        versions: rows.filter((v) => v.rule_key === r.rule_key),
        search: await sectionCounts(db, r.id),
      })),
  );
}

/** A one-time signed upload URL in the private state-rules bucket. */
export async function startStateRuleUpload(
  { db }: ExecCaller,
  file: { fileName: string; sizeBytes: number },
) {
  const problem = stateRuleFileProblem(file);
  if (problem) throw new Error(problem);
  const path = stateRuleObjectPath(file.fileName, crypto.randomUUID());
  const { data, error } = await db.storage.from(STATE_RULES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Could not start the upload. Try again.");
  return { bucket: STATE_RULES_BUCKET, path, token: data.token };
}

async function uploadedText(db: Db, upload: PublishStateRuleInput["upload"]): Promise<string> {
  if (!isStateRulePath(upload.path)) throw new Error("Upload the file again.");
  const problem = stateRuleFileProblem(upload);
  if (problem) throw new Error(problem);
  let bytes: Uint8Array;
  try {
    bytes = await readStoredFile(db, upload.path, STATE_RULES_BUCKET);
  } catch {
    throw new Error("Could not open the uploaded file. Upload it again.");
  }
  const read = await extractLibraryText(bytes, upload.fileName, upload.mimeType ?? null);
  if (read.parse_status === "no_text") throw new Error(STATE_RULE_NO_TEXT);
  if (read.parse_status !== "parsed") throw new Error("That file could not be read.");
  return read.raw_text;
}

/** Writes a version's sections if it has none, then embeds what it can before the deadline. */
async function updateSearch(
  db: Db,
  rule: Parameters<typeof indexStateRuleVersion>[1],
  deadline: number,
) {
  try {
    const now = await sectionCounts(db, rule.id);
    if (now.sections === 0) await indexStateRuleVersion(db, rule, { embed: false, deadline });
    await embedPendingSections(db, { stateDocumentId: rule.id }, { embed: true, deadline });
  } catch {
    console.error("[knowledge-base] state rule search update failed", { stateRuleId: rule.id });
  }
  return sectionCounts(db, rule.id);
}

/**
 * A new state rule, or a new version of one: the file's text becomes the new
 * current version, the old version is archived (kept) and leaves search, and
 * the new version's sections go into search before this returns.
 */
export async function publishStateRule({ db, userId }: ExecCaller, input: PublishStateRuleInput) {
  const deadline = Date.now() + STATE_RULE_EMBED_BUDGET_MS;
  let current: CurrentRule | null = null;
  if (input.ruleKey) {
    const { data } = await db
      .from("state_rule_documents")
      .select("id, rule_key, title, version, effective_from")
      .eq("rule_key", input.ruleKey)
      .is("archived_at", null)
      .maybeSingle();
    if (!data) throw new Error(NOT_FOUND);
    current = data;
  }
  const rawText = await uploadedText(db, input.upload);
  const plan = planStateRuleVersion(current, input);
  if (!current) {
    const { data: taken } = await db
      .from("state_rule_documents")
      .select("id")
      .eq("rule_key", plan.rule_key)
      .limit(1);
    if (taken?.length) {
      throw new Error("A state rule with this name already exists. Upload a new version of it.");
    }
  }
  const now = new Date().toISOString();
  if (current) {
    const { error } = await db
      .from("state_rule_documents")
      .update({ archived_at: now })
      .eq("id", current.id)
      .is("archived_at", null);
    if (error) throw new Error("Could not replace the current version.");
  }
  const { data: next, error } = await db
    .from("state_rule_documents")
    .insert({
      ...plan,
      raw_text: rawText,
      file_name: input.upload.fileName,
      storage_bucket: STATE_RULES_BUCKET,
      storage_path: input.upload.path,
      published_at: now,
      created_by: userId,
    })
    .select(INDEX_COLUMNS)
    .single();
  if (error || !next) {
    if (current) {
      await db.from("state_rule_documents").update({ archived_at: null }).eq("id", current.id);
    }
    throw new Error("Could not publish the state rule.");
  }
  if (current) await retireSections(db, { stateDocumentId: current.id });
  return { id: next.id, version: next.version, search: await updateSearch(db, next, deadline) };
}

/** "Update search": puts the current version in Nectar search and embeds more of it. */
export async function updateStateRuleSearch({ db }: ExecCaller, stateRuleId: string) {
  const { data: rule } = await db
    .from("state_rule_documents")
    .select(`${INDEX_COLUMNS}, archived_at`)
    .eq("id", stateRuleId)
    .maybeSingle();
  if (!rule) throw new Error(NOT_FOUND);
  if (rule.archived_at) throw new Error("Only the current version goes in Nectar search.");
  return updateSearch(db, rule, Date.now() + STATE_RULE_EMBED_BUDGET_MS);
}
