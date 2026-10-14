// Every question asked of Nectar is logged to nectar_questions, and the asker
// can rate the answer (N5, Decisions 8 and 9). No runtime aliases, so
// node --test can import it.
//
// found = false logs the question as open, so it shows in the admin Questions
// tab. A thumbs-down opens it too. Only agency-wide admins may update
// nectar_questions under RLS, so the thumbs write uses a server-side client,
// after this file checks the caller asked that question. Nothing is deleted.
// Never logs question or answer text to the console; ids only.

import type { FeedbackResult, FeedbackValue, NectarAskCaller, NectarDb } from "./ask-types.ts";

export const QUESTION_NOT_FOUND = "Question not found.";

export interface QuestionLog {
  question: string;
  answer: string;
  found: boolean;
  citedSectionIds: string[];
  clientIds: string[];
  askerName: string | null;
}

/** The asker's name for the Questions tab, and the agency's name for the prompt. */
export async function loadAskerAndAgency(
  db: NectarDb,
  caller: Pick<NectarAskCaller, "userId" | "orgId">,
): Promise<{ askerName: string | null; orgName: string }> {
  const [profile, org] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", caller.userId).maybeSingle(),
    db.from("organizations").select("name").eq("id", caller.orgId).maybeSingle(),
  ]);
  return {
    askerName: profile.data?.full_name?.trim() || profile.data?.email || null,
    orgName: org.data?.name?.trim() || "your agency",
  };
}

/** The nectar_questions row for one question. Not found → open. */
export function questionRow(caller: NectarAskCaller, log: QuestionLog) {
  return {
    organization_id: caller.orgId,
    asked_by: caller.userId,
    asker_name: log.askerName,
    scope: caller.view,
    client_ids: [...new Set(log.clientIds)],
    question: log.question,
    answer: log.answer,
    cited_section_ids: [...new Set(log.citedSectionIds)],
    found: log.found,
    status: log.found ? null : ("open" as const),
  };
}

/** Logs the question; returns its id, or null when the log could not be written. */
export async function logQuestion(
  db: NectarDb,
  caller: NectarAskCaller,
  log: QuestionLog,
): Promise<string | null> {
  const { data, error } = await db
    .from("nectar_questions")
    .insert(questionRow(caller, log))
    .select("id")
    .single();
  if (error || !data) {
    console.error("[nectar] could not log a question", {
      orgId: caller.orgId,
      userId: caller.userId,
    });
    return null;
  }
  return data.id;
}

export interface FeedbackRow {
  found: boolean;
  status: string | null;
  feedback: string | null;
}

/** Thumbs down opens the question again; thumbs up on a found answer clears an open flag. */
export function feedbackPatch(row: FeedbackRow, value: FeedbackValue) {
  if (value === "down") {
    return { feedback: value, status: "open" as const, resolved_at: null, resolved_by: null };
  }
  const status =
    row.found && row.status === "open" ? null : (row.status as "open" | "resolved" | null);
  return { feedback: value, status };
}

/**
 * Saves a thumbs up or down on the caller's own question. `read` is the
 * caller's data client; `write` is the server-side client used only after the
 * ownership check.
 */
export async function recordFeedback(
  read: NectarDb,
  write: NectarDb,
  caller: Pick<NectarAskCaller, "userId" | "orgId">,
  questionId: string,
  value: FeedbackValue,
): Promise<FeedbackResult> {
  const { data: row } = await read
    .from("nectar_questions")
    .select("id, organization_id, asked_by, found, status, feedback")
    .eq("id", questionId)
    .eq("organization_id", caller.orgId)
    .maybeSingle();
  if (!row || row.asked_by !== caller.userId || row.organization_id !== caller.orgId) {
    throw new Error(QUESTION_NOT_FOUND);
  }
  const patch = feedbackPatch(row, value);
  const { error } = await write
    .from("nectar_questions")
    .update(patch)
    .eq("id", questionId)
    .eq("organization_id", caller.orgId)
    .eq("asked_by", caller.userId);
  if (error) throw new Error("Could not save your feedback.");
  return { questionId, feedback: value, status: patch.status, off: false };
}
