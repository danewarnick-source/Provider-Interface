// Server-only rate-limit helper for NECTAR Bedrock calls.
// Backed by public.nectar_rate_state so all workers (server tick, client-driver
// requests, other server fns) share a single sliding-window counter.
//
// Bedrock quotas (Claude Sonnet 4.5/4.6 on cross-region + global cross-region):
// - 10 requests / minute (not adjustable at our tier)
// - 6,000,000 tokens / minute (fine; we won't approach this)
// - 5,400,000 invocation tokens / day (this is the real ceiling)
//
// We target 80% of RPM to leave headroom for retries and other NECTAR features.
// Each agency also has its own 4/min and 1.5M/day cap so one org cannot take
// the whole account quota. The global key stays the hard ceiling.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decideBedrockSlot } from "@/lib/nectar-rate-decision";

// Public knobs — kept as consts so callers can share the exact same key.
export const BEDROCK_RATE_KEY = "bedrock:sonnet";
export const BEDROCK_MAX_PER_MIN = 8;                // 80% of 10 rpm
export const BEDROCK_DAILY_TOKEN_CAP = 5_000_000;    // ~93% of 5.4M/day
export const BEDROCK_ORG_MAX_PER_MIN = 4;
export const BEDROCK_ORG_DAILY_TOKEN_CAP = 1_500_000;
const ACQUIRE_MAX_WAIT_MS = 60_000;                   // give up if bucket stays full this long
const ACQUIRE_POLL_CAP_MS = 8_000;                    // never sleep longer than this at once
const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bedrockOrgRateKey(orgId: string): string {
  return `${BEDROCK_RATE_KEY}:org:${orgId}`;
}

export function normalizeBedrockOrgId(orgId?: string | null): string | null {
  const value = String(orgId ?? "").trim();
  return ORG_ID_RE.test(value) ? value : null;
}

export class RateLimitError extends Error {
  waitMs: number;
  dayFull: boolean;
  constructor(msg: string, waitMs: number, dayFull: boolean) {
    super(msg);
    this.name = "RateLimitError";
    this.waitMs = waitMs;
    this.dayFull = dayFull;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type RateProbe = {
  error: string | null;
  waitMs: number;
  dayTokensUsed: number;
  dayFull: boolean;
};

async function probeRate(key: string, maxPerMin: number, dailyCap: number): Promise<RateProbe> {
  const { data, error } = await supabaseAdmin.rpc("nectar_check_rate", {
    p_key: key,
    p_max_per_min: maxPerMin,
    p_daily_token_cap: dailyCap,
  });
  const row = error ? null : Array.isArray(data) ? data[0] : data;
  return {
    error: error ? error.message : null,
    waitMs: Number(row?.wait_ms ?? 0),
    dayTokensUsed: Number(row?.day_tokens_used ?? 0),
    dayFull: Boolean(row?.day_full),
  };
}

/**
 * Block until the shared bucket grants a slot, or throw RateLimitError if the
 * caller would have to wait longer than ACQUIRE_MAX_WAIT_MS. Safe to call from
 * multiple parallel workers — Postgres row lock in the RPC serializes access.
 *
 * When orgId is a uuid, also acquire `bedrock:sonnet:org:<orgId>` (4/min,
 * 1.5M tokens/day). A missing or invalid orgId checks the global key only.
 * nectar_check_rate increments on grant, so a bucket that already granted
 * during this wait is not probed again.
 */
export async function acquireBedrockSlot(orgId?: string | null): Promise<{ dayTokensUsed: number }> {
  const started = Date.now();
  const scoped = normalizeBedrockOrgId(orgId);
  const orgKey = scoped ? bedrockOrgRateKey(scoped) : null;
  let heldOrg = false;
  let heldGlobal = false;
  let lastGlobalDay = 0;

  while (true) {
    const elapsed = Date.now() - started;
    if (orgKey && !heldOrg) {
      const org = await probeRate(orgKey, BEDROCK_ORG_MAX_PER_MIN, BEDROCK_ORG_DAILY_TOKEN_CAP);
      const orgDecision = decideBedrockSlot({
        limiterError: org.error,
        waitMs: org.waitMs,
        dayTokensUsed: org.dayTokensUsed,
        dayFull: org.dayFull,
        elapsedMs: elapsed,
        maxWaitMs: ACQUIRE_MAX_WAIT_MS,
      });
      if (org.error) console.warn("[nectar-rate] org check_rate failed:", org.error);
      if (orgDecision.action === "fail_closed") {
        throw new RateLimitError(orgDecision.message, orgDecision.waitMs, orgDecision.dayFull);
      }
      if (orgDecision.action === "wait") {
        await sleep(Math.min(orgDecision.waitMs, ACQUIRE_POLL_CAP_MS));
        continue;
      }
      heldOrg = true;
    }

    if (!heldGlobal) {
      const global = await probeRate(BEDROCK_RATE_KEY, BEDROCK_MAX_PER_MIN, BEDROCK_DAILY_TOKEN_CAP);
      if (!global.error) lastGlobalDay = global.dayTokensUsed;
      const decision = decideBedrockSlot({
        limiterError: global.error,
        waitMs: global.waitMs,
        dayTokensUsed: lastGlobalDay,
        dayFull: global.dayFull,
        elapsedMs: Date.now() - started,
        maxWaitMs: ACQUIRE_MAX_WAIT_MS,
      });
      if (global.error) console.warn("[nectar-rate] check_rate failed:", global.error);
      if (decision.action === "fail_closed") {
        throw new RateLimitError(decision.message, decision.waitMs, decision.dayFull);
      }
      if (decision.action === "wait") {
        await sleep(Math.min(decision.waitMs, ACQUIRE_POLL_CAP_MS));
        continue;
      }
      heldGlobal = true;
    }

    return { dayTokensUsed: lastGlobalDay };
  }
}

/** Best-effort: add tokens consumed by a completed Bedrock call to the daily bucket. */
export async function recordBedrockTokens(tokens: number, orgId?: string | null): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const rounded = Math.round(tokens);
  const scoped = normalizeBedrockOrgId(orgId);
  const keys = scoped ? [BEDROCK_RATE_KEY, bedrockOrgRateKey(scoped)] : [BEDROCK_RATE_KEY];
  for (const key of keys) {
    const { error } = await supabaseAdmin.rpc("nectar_record_tokens", {
      p_key: key,
      p_tokens: rounded,
    });
    if (error) console.warn("[nectar-rate] record_tokens failed:", error.message);
  }
}
