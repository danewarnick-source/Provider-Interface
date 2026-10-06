// Destructive lifecycle action: discard an uncommitted smart import.
// Admin-only; the RPC re-checks org role server-side via a SECURITY DEFINER
// Postgres function. Clients themselves are never deleted — they are archived.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const JobInput = z.object({ jobId: z.string().uuid() });

export const discardImportJobHard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) return { ok: false, job_id: data.jobId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: res, error } = await sb.rpc("discard_import_job_hard", { _job_id: data.jobId });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; job_id: string };
  });
