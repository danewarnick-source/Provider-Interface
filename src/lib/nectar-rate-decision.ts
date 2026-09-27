/**
 * Pure Nectar rate-limit decision. A limiter error fails closed.
 * The server helper in nectar-rate-limit.server.ts uses this before it
 * waits or calls Bedrock.
 */

export type BedrockSlotDecision =
  | { action: "grant"; dayTokensUsed: number }
  | { action: "wait"; waitMs: number }
  | { action: "fail_closed"; message: string; waitMs: number; dayFull: boolean };

export function decideBedrockSlot(input: {
  limiterError: string | null;
  waitMs: number;
  dayTokensUsed: number;
  dayFull: boolean;
  elapsedMs: number;
  maxWaitMs: number;
}): BedrockSlotDecision {
  if (input.limiterError) {
    return {
      action: "fail_closed",
      message: "Nectar rate limiter is unavailable. Try again in a moment.",
      waitMs: 0,
      dayFull: false,
    };
  }
  if (input.waitMs === 0) {
    return { action: "grant", dayTokensUsed: input.dayTokensUsed };
  }
  if (input.dayFull) {
    return {
      action: "fail_closed",
      message: "Bedrock daily token budget exhausted. Resets at 00:00 UTC.",
      waitMs: input.waitMs,
      dayFull: true,
    };
  }
  if (input.elapsedMs + input.waitMs > input.maxWaitMs) {
    return {
      action: "fail_closed",
      message: `Bedrock rate limit: still waiting after ${Math.round(input.elapsedMs / 1000)}s.`,
      waitMs: input.waitMs,
      dayFull: false,
    };
  }
  return { action: "wait", waitMs: input.waitMs };
}
