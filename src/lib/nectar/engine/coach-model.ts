// Shared plumbing for the note-coach runners in this folder: the model call
// they take and lenient parsing of its JSON reply. ai-coach.functions.ts
// builds the model with coachModelFor, so every call carries the caller's
// agency and is charged to that agency's Bedrock rate limit.

/** System + user prompt in, raw model text out. */
export type CoachModel = (system: string, user: string) => Promise<string>;

type ChatBody = {
  model: "bedrock";
  messages: Array<{ role: "system" | "user"; content: string }>;
  response_format: { type: "json_object" };
};

/** The part of gatewayFetch (lib/ai-bedrock.server.ts) the coach uses. */
export type CoachGateway = (
  body: ChatBody,
  opts: { signal?: AbortSignal; orgId: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export const COACH_RATE_LIMIT_MESSAGE = "AI rate limit reached. Please retry in a moment.";

/** A CoachModel that always sends `orgId`, so the per-agency rate limit applies. */
export function coachModelFor(
  gateway: CoachGateway,
  orgId: string,
  signal?: AbortSignal,
): CoachModel {
  return async (system, user) => {
    const res = await gateway(
      {
        model: "bedrock",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      },
      { signal, orgId },
    );
    if (res.status === 429) throw new Error(COACH_RATE_LIMIT_MESSAGE);
    if (!res.ok) throw new Error(`AI error (${res.status}).`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "";
  };
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The model's JSON reply; falls back to the first {...} block, then to {}. */
export function parseModelJson(raw: string): Record<string, unknown> {
  let parsed = tryParse(raw);
  if (parsed === undefined) {
    const block = raw.match(/\{[\s\S]*\}/)?.[0];
    parsed = block ? tryParse(block) : undefined;
  }
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}
