// The one Nectar engine's server functions (N5): askNectar for both Ask
// screens (admin /dashboard/help, staff /dashboard/ask-nectar) and
// feedbackNectar for thumbs up / down.
//
// Every call checks, on the server, before anything else: signed in, an
// active member of the agency, the agency has `nectar` on and its Ask setting
// on (Decision 10). Nectar or Ask off returns the "Ask is turned off" result
// instead of an error. The view is checked against access: the admin view is
// for owners and agency-wide admins only. Bedrock calls go through
// ai-bedrock.server.ts with the agency's id, so the per-agency rate limit
// (nectar-rate-limit.server.ts) applies to the embedding and the model call.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { gatewayEmbeddingsFetch, gatewayFetch } from "@/lib/ai-bedrock.server";
import { isAgencyAdmin } from "@/lib/access/levels";
import { EMBED_DIMENSIONS, vectorLiteral } from "@/lib/nectar/library/indexing";
import { runAskNectar } from "./ask";
import { AskInput, FeedbackInput } from "./ask-input";
import {
  ADMIN_VIEW_ONLY,
  askOffResult,
  type AskNectarResult,
  type FeedbackResult,
  type NectarDb,
} from "./ask-types";
import { isNectarOff } from "./guard";
import { nectarCaller, type NectarContext } from "./guard.server";
import { recordFeedback } from "./questions";

export const NECTAR_BUSY = "Nectar is busy right now. Try again in a moment.";
export const NECTAR_UNAVAILABLE = "Nectar isn't available right now. Try again in a moment.";

/** Signed in, active member, `nectar` and Ask on. Null means Nectar or Ask is off. */
async function askCaller(context: NectarContext, organizationId: string) {
  const check = await nectarCaller(context, { orgId: organizationId, feature: "ask" });
  if (!check.ok) {
    if (isNectarOff(check)) return null;
    throw new Error(check.message);
  }
  const db = context.supabase as NectarDb;
  const userId = context.userId as string;
  const access = await requireOrgMembership(db, userId, check.orgId);
  return { db, userId, orgId: check.orgId, agencyAdmin: isAgencyAdmin(access.level, access.scope) };
}

/** The question's Titan v2 embedding (size 1024), charged to the agency; null when it fails. */
function questionEmbedder(orgId: string) {
  return async (text: string): Promise<string | null> => {
    const res = await gatewayEmbeddingsFetch(
      { input: text, dimensions: EMBED_DIMENSIONS },
      { orgId },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding?: unknown }> };
    return vectorLiteral(json.data?.[0]?.embedding);
  };
}

/** One model call, charged to the agency; a cancelled request stops it. */
function nectarModel(orgId: string, signal?: AbortSignal) {
  return async (system: string, user: string): Promise<string> => {
    const res = await gatewayFetch(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 1200,
        temperature: 0.1,
      },
      { orgId, signal },
    );
    if (res.status === 429) throw new Error(NECTAR_BUSY);
    if (!res.ok) throw new Error(NECTAR_UNAVAILABLE);
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  };
}

/** Ask Nectar. Answers only from what the asker may see, with checked sources. */
export const askNectar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<AskNectarResult> => {
    const caller = await askCaller(context, data.organizationId);
    if (!caller) return askOffResult();
    if (data.view === "admin" && !caller.agencyAdmin) throw new Error(ADMIN_VIEW_ONLY);
    return runAskNectar(
      {
        userId: caller.userId,
        orgId: caller.orgId,
        view: data.view,
        agencyAdmin: caller.agencyAdmin,
      },
      data.question,
      {
        db: caller.db,
        embed: questionEmbedder(caller.orgId),
        model: nectarModel(caller.orgId, getRequest()?.signal),
      },
    );
  });

/** Thumbs up or down on the caller's own answer. Down puts it in the Questions tab. */
export const feedbackNectar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FeedbackInput.parse(input))
  .handler(async ({ data, context }): Promise<FeedbackResult> => {
    const caller = await askCaller(context, data.organizationId);
    if (!caller) return { questionId: data.questionId, feedback: null, status: null, off: true };
    return recordFeedback(
      caller.db,
      supabaseAdmin as unknown as NectarDb,
      caller,
      data.questionId,
      data.value,
    );
  });
