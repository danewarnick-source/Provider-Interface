// State rules server functions for PI's executives (N4, Decision 6). Screen:
// the "State rules" section of /dashboard/hive-exec/knowledge. Each one checks
// on the server that the caller is signed in and an active hive executive
// (state-rules.server.ts) before it reads or writes anything; RLS lets only
// hive executives change state rules, their sections and their files.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PublishStateRuleInput, StateRuleIdInput, StateRuleUploadUrlInput } from "./state-rules";
import {
  publishStateRule,
  readStateRules,
  requireHiveExecutive,
  startStateRuleUpload,
  updateStateRuleSearch,
} from "./state-rules.server";

/** Every state rule's current version, its older versions and how much of it is in search. */
export const listStateRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => readStateRules(await requireHiveExecutive(context)));

/** A one-time signed upload URL for a state rule file (PDF, Word or text). */
export const createStateRuleUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StateRuleUploadUrlInput.parse(input))
  .handler(async ({ data, context }) =>
    startStateRuleUpload(await requireHiveExecutive(context), data),
  );

/** Upload a new state rule, or replace one with a new version (the old one is archived). */
export const publishStateRuleVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishStateRuleInput.parse(input))
  .handler(async ({ data, context }) =>
    publishStateRule(await requireHiveExecutive(context), data),
  );

/** "Update search": the current version's sections into Nectar search, a batch of embeddings at a time. */
export const refreshStateRuleSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StateRuleIdInput.parse(input))
  .handler(async ({ data, context }) =>
    updateStateRuleSearch(await requireHiveExecutive(context), data.stateRuleId),
  );
