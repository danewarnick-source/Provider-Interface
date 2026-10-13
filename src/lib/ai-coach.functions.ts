// Note-coach server functions used by punch-pad, daily logs, HHS daily notes,
// shift-note drafts and incident reports. Names, inputs and outputs are what
// those screens call; prompts and parsing live in src/lib/nectar/engine/coach-*.ts.
//
// Every call runs the Nectar guard (signed in, active member, `nectar` on for
// the agency, and the agency's AI setting for the feature on: shift note help
// for the note and incident helpers, Ask for the procedural question) and
// charges the caller's agency in the per-agency Bedrock rate limit. Two calls
// never block the person on Nectar: the submit completeness check falls back
// to the local word count when Nectar or shift note help is off, and the
// incident reviewer stays fail-open.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, assertBedrockConfigured } from "@/lib/ai-bedrock.server";
import { coachModelFor, type CoachModel } from "@/lib/nectar/engine/coach-model";
import { isNectarOff } from "@/lib/nectar/engine/guard";
import { nectarCaller, requireNectarOrg } from "@/lib/nectar/engine/guard.server";
import {
  runDraftShiftNote,
  runEvaluateShiftNote,
  runScanNoteForTriggers,
  validateCoach,
  validateDraft,
  validateScan,
  type CoachResult,
  type DraftResult,
  type ScanResult,
} from "@/lib/nectar/engine/coach-notes";
import {
  runAnswerProcedural,
  validateProcedural,
  type ProceduralResult,
} from "@/lib/nectar/engine/coach-assist";
import {
  reviewMessages,
  runDraftIncidentNarrative,
  shapeReviewReply,
  skippedReview,
  validateIncidentDraft,
  validateReviewInput,
  type IncidentDraftResult,
  type IncidentReviewResult,
} from "@/lib/nectar/engine/coach-incidents";

export type { CoachResult, DraftResult, ScanResult, ShiftNoteFollowUp } from "@/lib/nectar/engine/coach-notes";
export type { ProceduralResult } from "@/lib/nectar/engine/coach-assist";
export type {
  IncidentDraftGap,
  IncidentDraftResult,
  IncidentReviewIssue,
  IncidentReviewResult,
} from "@/lib/nectar/engine/coach-incidents";

/** The note and incident helpers run under the agency's "Shift note help" setting. */
const NOTE_HELP = { feature: "note_help" } as const;

/**
 * The model for this request, charged to the caller's agency. It forwards the
 * request's abort signal so a client-side cancel (e.g. the 20s incident-report
 * timeout) stops the Bedrock call instead of letting it burn a rate-limit slot.
 */
function coachModel(orgId: string): CoachModel {
  const model = coachModelFor(gatewayFetch, orgId, getRequest()?.signal);
  return (system, user) => {
    assertBedrockConfigured();
    return model(system, user);
  };
}

// ─── Documentation Quality Coach (submit-time completeness check) ───────────

export const evaluateShiftNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCoach)
  .handler(async ({ data, context }): Promise<CoachResult> => {
    const caller = await nectarCaller(context, NOTE_HELP);
    if (!caller.ok && !isNectarOff(caller)) throw new Error(caller.message);
    return runEvaluateShiftNote(data, caller.ok ? coachModel(caller.orgId) : null);
  });

// ─── Draft Assist — expand shorthand/voice into a compliant draft note ───────

export const draftShiftNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateDraft)
  .handler(async ({ data, context }): Promise<DraftResult> =>
    runDraftShiftNote(data, coachModel(await requireNectarOrg(context, NOTE_HELP))),
  );

// ─── Procedural Q&A — "am I allowed to…?" grounded in client context ─────────

export const answerProceduralQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProcedural)
  .handler(async ({ data, context }): Promise<ProceduralResult> =>
    runAnswerProcedural(data, coachModel(await requireNectarOrg(context, { feature: "ask" }))),
  );

// ─── Content Scanner — runs AFTER quality coach passes ───────────────────────

export const scanNoteForTriggers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateScan)
  .handler(async ({ data, context }): Promise<ScanResult> =>
    runScanNoteForTriggers(data, coachModel(await requireNectarOrg(context, NOTE_HELP))),
  );

// ─── Incident-report narrative drafter ───────────────────────────────────────

export const draftIncidentNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateIncidentDraft)
  .handler(async ({ data, context }): Promise<IncidentDraftResult> =>
    runDraftIncidentNarrative(data, coachModel(await requireNectarOrg(context, NOTE_HELP))),
  );

// ─── Incident report reviewer ───────────────────────────────────────────────
// Runs as a TanStack server function so it uses the Node-side `gatewayFetch`
// (the Deno Bedrock shim crashes on Http2Session.settings). Fail-open: a
// refused caller or any error returns a skipped review, never a block.

export const reviewIncidentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateReviewInput)
  .handler(async ({ data, context }): Promise<IncidentReviewResult> => {
    try {
      const caller = await nectarCaller(context, NOTE_HELP);
      if (!caller.ok) return skippedReview(caller.message);

      const aiRes = await gatewayFetch({
        messages: reviewMessages(data.draft),
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.1,
      } as Parameters<typeof gatewayFetch>[0], { signal: getRequest()?.signal, orgId: caller.orgId });

      if (!aiRes.ok) {
        const t = await aiRes.text().catch(() => "");
        console.error("[reviewIncidentReport] non-2xx", aiRes.status, t.slice(0, 200));
        return skippedReview(t.slice(0, 200));
      }

      const j = (await aiRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return shapeReviewReply(j.choices?.[0]?.message?.content);
    } catch (e) {
      console.error("[reviewIncidentReport] threw", e);
      return skippedReview((e as Error).message?.slice(0, 200));
    }
  });
