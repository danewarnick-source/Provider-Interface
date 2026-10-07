// Save the "Finish setting up" answers (what the agency does for a client)
// and finish the setup. Needs Clients edit on this client
// (assertCanManageClient). Reading is RLS-scoped from the browser.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { SCOPE_ANSWERS, cleanAnswers } from "./support-scope";
import { saveSupportScope } from "./support-scope.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const answersSchema = z.object(
  Object.fromEntries(SCOPE_ANSWERS.map((k) => [k, z.boolean().nullable().optional()])),
);

export const saveClientSupportScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clientId: z.string().uuid(),
        answers: answersSchema,
        finished: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) throw new Error("Not signed in.");
    const sb = context.supabase as Sb;
    await assertCanManageClient({
      supabase: sb,
      actorId: context.userId,
      organizationId: data.organizationId,
      clientId: data.clientId,
      action: "edit",
    });
    await saveSupportScope(sb, {
      organizationId: data.organizationId,
      clientId: data.clientId,
      userId: context.userId,
      answers: cleanAnswers(data.answers),
      finished: data.finished,
    });
    return { ok: true as const };
  });
