// Helpers for authoritative-sources.functions.ts. These live in a separate
// module because TanStack Start's server-fn code splitter
// (?tss-serverfn-split) breaks sibling module-scope references from within
// handler bodies. See docs/tanstack-serverfn-splitting.

export const AUTH_KINDS = [
  "state_sow",
  "provider_contract",
  "dspd_requirement",
  "dhs_requirement",
  "public_record",
  "tool_template",
  "provider_policy",
  "other",
] as const;
