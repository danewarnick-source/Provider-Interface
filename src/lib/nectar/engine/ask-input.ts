// Inputs of askNectar and feedbackNectar (N5). Pure (zod only), so node --test
// can import it. The view names a screen; what it may read comes from access.

import { z } from "zod";
import { ASK_VIEWS } from "./ask-types.ts";

export const QUESTION_MAX = 2000;

export const AskInput = z.object({
  organizationId: z.string().uuid(),
  question: z
    .string()
    .trim()
    .min(2, "Ask a question of at least 2 characters.")
    .max(QUESTION_MAX, "Keep the question under 2,000 characters."),
  view: z.enum(ASK_VIEWS),
});
export type AskInput = z.infer<typeof AskInput>;

/** Whether Ask is on for the agency (N6): both Ask screens read it before anyone asks. */
export const AskStatusInput = z.object({ organizationId: z.string().uuid() });

export const FeedbackInput = z.object({
  organizationId: z.string().uuid(),
  questionId: z.string().uuid(),
  value: z.enum(["up", "down"]),
});
export type FeedbackInput = z.infer<typeof FeedbackInput>;
