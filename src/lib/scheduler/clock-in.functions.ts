// The punch pad's rule check before a clock-in is written (B1). Thin wrapper
// over clockInCheck (clock-in.server.ts): runs as the signed-in team member.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clockInCheck } from "@/lib/scheduler/clock-in.server";

const Input = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  serviceCode: z.string().min(1).max(16),
  reason: z.string().max(1000).nullable().optional(),
});

export const checkClockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof Input>) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.supabase || !context.userId) throw new Error("Sign in again to clock in.");
    return clockInCheck(context.supabase, {
      orgId: data.organizationId,
      staffId: context.userId,
      clientId: data.clientId,
      code: data.serviceCode,
      now: new Date(),
      reason: data.reason ?? null,
    });
  });
