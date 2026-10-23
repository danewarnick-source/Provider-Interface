// Client-specific training content: the sections and items a training holds
// (verbatim client data, never model prose) and the schemas that check them.
// Pure, so screens and shared rules can read the shape without server code.
import { z } from "zod";

// ── Content shape ────────────────────────────────────────────────────────────
// Sections of VERBATIM values from authoritative client data — no model prose.
// item.kind:
//   'text'  — single verbatim string
//   'list'  — array of verbatim strings/labels
//   'kv'    — array of {label, value} pairs (verbatim)
//   'link'  — array of {label, href} (document filenames + signed/public links)
//   'note'  — short fixed system label (e.g. "No data on file"); never authored care prose
export type CSTItem =
  | { kind: "text"; label: string; value: string }
  | { kind: "list"; label: string; values: string[] }
  | { kind: "kv"; label: string; pairs: Array<{ label: string; value: string }> }
  | { kind: "link"; label: string; links: Array<{ label: string; href: string | null }> }
  | { kind: "note"; label: string; value: string };

export type CSTSection = {
  id: string;
  title: string;
  items: CSTItem[];
  /** Service/job code(s) this strategy section covers (support_strategies
   *  training only — SOW §1.24(5) coverage check reads this). */
  job_codes?: string[];
  /** Support strategies: the client_goal_supports row this section is for. */
  support_id?: string;
  /** Support strategies: a person edited it, so a rebuild keeps it. */
  edited?: boolean;
  /** Support strategies: Nectar drafted it (cleared once a person edits it). */
  nectar?: boolean;
};
export type CSTContent = {
  sections: CSTSection[];
  /** Support strategies: why they were approved with supports still lacking one. */
  approval_note?: string;
  /**
   * Support strategies: the uploaded strategies document (client_documents
   * id), the official copy. Kept when Nectar copies its strategies in.
   */
  source_document_id?: string;
};

// Applied-reasoning prompt shown to staff per tab.
export type CSTReviewQuestion = {
  id: string;
  tab: string;     // which tab this question belongs to (e.g. "pcsp", "support_strategies")
  prompt: string;  // the question text
};

// A staff member's written answer, frozen onto the completion.
export type CSTQuestionAnswer = {
  question: string;
  answer: string;
  tab: string;
};

export type CSTTrainingType = "person_specific" | "support_strategies";

export const ItemSchema: z.ZodType<CSTItem> = z.union([
  z.object({ kind: z.literal("text"), label: z.string(), value: z.string() }),
  z.object({ kind: z.literal("list"), label: z.string(), values: z.array(z.string()) }),
  z.object({ kind: z.literal("kv"), label: z.string(), pairs: z.array(z.object({ label: z.string(), value: z.string() })) }),
  z.object({ kind: z.literal("link"), label: z.string(), links: z.array(z.object({ label: z.string(), href: z.string().nullable() })) }),
  z.object({ kind: z.literal("note"), label: z.string(), value: z.string() }),
]);
export const SectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  items: z.array(ItemSchema).max(50),
  job_codes: z.array(z.string()).optional(),
  support_id: z.string().max(64).optional(),
  edited: z.boolean().optional(),
  nectar: z.boolean().optional(),
});
export const ContentSchema = z.object({
  sections: z.array(SectionSchema).max(60),
  approval_note: z.string().max(2000).optional(),
  source_document_id: z.string().uuid().optional(),
});
export const ReviewQuestionSchema = z.object({
  id: z.string(),
  tab: z.string(),
  prompt: z.string(),
});

export function sid(): string { return `s_${Math.random().toString(36).slice(2, 10)}`; }
