// The admin Questions tab (N6, Decision 9): questions Nectar couldn't answer
// and answers someone marked not helpful, with the asker's name. Two actions
// only: Add to library (the Knowledge base's New document, prefilled from the
// question; saving it resolves the question) and Mark resolved / Reopen.
// No runtime aliases, so node --test runs it on a fake database.
//
// Runs on the caller's own data client after admin.functions.ts checked who
// is asking; every read and write also filters by the agency. Only flagged
// questions (status open or resolved) are listed or changed, and nothing is
// deleted. Never logs question or answer text.

import { z } from "zod";
import { denverYmdFromInstant } from "../../denver-date.ts";
import { formatInstant } from "../library/knowledge-view.ts";
import type { NectarDb } from "./ask-types.ts";

export const QUESTION_FILTERS = ["open", "resolved", "all"] as const;
export type QuestionFilter = (typeof QUESTION_FILTERS)[number];

const QUESTION_STATUSES = ["open", "resolved"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** The most questions one filter lists, newest first. */
const QUESTIONS_LIMIT = 200;

const OrgId = z.string().uuid();

export const QuestionsInput = z.object({
  organizationId: OrgId,
  filter: z.enum(QUESTION_FILTERS).default("open"),
});

export const QuestionStatusInput = z.object({
  organizationId: OrgId,
  questionId: z.string().uuid(),
  status: z.enum(QUESTION_STATUSES),
});

export type QuestionKind = "not_found" | "not_helpful";

const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  not_found: "No answer found",
  not_helpful: "Marked not helpful",
};

const QUESTION_COLUMNS =
  "id, asker_name, question, answer, found, feedback, status, created_at, resolved_at" as const;

export interface QuestionRow {
  id: string;
  asker_name: string | null;
  question: string;
  answer: string | null;
  found: boolean;
  feedback: string | null;
  status: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Not found (including a pay or hours refusal), or an answer someone thumbed down. */
export function questionKind(row: Pick<QuestionRow, "found">): QuestionKind {
  return row.found ? "not_helpful" : "not_found";
}

/** "Today" for a question asked today (Mountain Time), otherwise "Oct 10". */
export function askedWhen(createdAt: string, today: string): string {
  return denverYmdFromInstant(createdAt) === today ? "Today" : formatInstant(createdAt, true);
}

/** Nectar's answer as a card shows it: only a real answer, without its [1] markers. */
export function cardAnswer(row: Pick<QuestionRow, "found" | "answer">): string | null {
  if (!row.found) return null;
  const text = (row.answer ?? "").replace(/[ \t]*\[\d+\]/g, "").trim();
  return text || null;
}

export function questionCard(row: QuestionRow, today: string) {
  const kind = questionKind(row);
  return {
    id: row.id,
    kind,
    kindLabel: QUESTION_KIND_LABEL[kind],
    asker: row.asker_name?.trim() || "A team member",
    when: askedWhen(row.created_at, today),
    question: row.question,
    answer: cardAnswer(row),
    status: (row.status === "resolved" ? "resolved" : "open") as QuestionStatus,
  };
}
export type QuestionCard = ReturnType<typeof questionCard>;

export function statusesFor(filter: QuestionFilter): QuestionStatus[] {
  return filter === "all" ? [...QUESTION_STATUSES] : [filter];
}

/** One filter of the Questions tab, newest first. */
export async function listQuestions(
  db: NectarDb,
  orgId: string,
  filter: QuestionFilter,
  today: string,
): Promise<{ questions: QuestionCard[] }> {
  const { data, error } = await db
    .from("nectar_questions")
    .select(QUESTION_COLUMNS)
    .eq("organization_id", orgId)
    .in("status", statusesFor(filter))
    .order("created_at", { ascending: false })
    .limit(QUESTIONS_LIMIT);
  if (error) throw new Error("Could not load the questions.");
  return { questions: ((data ?? []) as QuestionRow[]).map((r) => questionCard(r, today)) };
}

/** "Questions (N open)" and the Nectar nav count. */
export async function countOpenQuestions(db: NectarDb, orgId: string): Promise<number> {
  const { count, error } = await db
    .from("nectar_questions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "open");
  if (error) throw new Error("Could not count the open questions.");
  return count ?? 0;
}

/** Mark resolved (dated, with who resolved it) or Reopen. */
export async function setQuestionStatus(
  db: NectarDb,
  caller: { orgId: string; userId: string },
  questionId: string,
  status: QuestionStatus,
): Promise<{ id: string; status: QuestionStatus }> {
  const patch =
    status === "resolved"
      ? { status, resolved_at: new Date().toISOString(), resolved_by: caller.userId }
      : { status, resolved_at: null, resolved_by: null };
  const { data, error } = await db
    .from("nectar_questions")
    .update(patch)
    .eq("id", questionId)
    .eq("organization_id", caller.orgId)
    .not("status", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Could not update the question.");
  if (!data) throw new Error("Question not found.");
  return { id: data.id, status };
}
