// Admin Nectar's server functions (N6): the Questions tab, its count in the
// Nectar nav item, and AI settings (Decisions 9 and 10).
//
// Every call checks on the server, before anything else: signed in, an active
// member of the agency, the agency has `nectar` on, agency_settings View for
// reads or Edit for writes, and agency-wide scope (Standard Rules; today that
// means owners). These make no model call, so no AI setting applies, and AI
// settings stay reachable while Nectar is turned off. Reads and writes run on
// the caller's own data client, filtered by the agency.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAgencyAdmin } from "@/lib/access/levels";
import { requireCategory } from "@/lib/access/require";
import { denverYmd } from "@/lib/denver-date";
import type { NectarDb } from "./ask-types";
import { NECTAR_REFUSAL_MESSAGE } from "./guard";
import { loadNectarSettings, requireNectarOrg, type NectarContext } from "./guard.server";
import {
  countOpenQuestions,
  listQuestions,
  QuestionsInput,
  QuestionStatusInput,
  setQuestionStatus,
} from "./questions-admin";
import { saveSettings, SettingsInput } from "./settings";

const NECTAR_ADMIN_ONLY = "Only an owner or an agency-wide admin can manage Nectar.";

const OrgInput = z.object({ organizationId: z.string().uuid() });

/** Owner or agency-wide admin with agency_settings at `min`, in an agency with Nectar on. */
async function requireNectarAdmin(context: NectarContext, orgId: string, min: "view" | "edit") {
  if (!context.supabase || !context.userId) throw new Error(NECTAR_REFUSAL_MESSAGE.signed_out);
  const db = context.supabase as NectarDb;
  const userId = context.userId;
  await requireNectarOrg(context, { orgId, feature: null });
  const access = await requireCategory(db, userId, orgId, "agency_settings", min);
  if (!isAgencyAdmin(access.level, access.scope)) throw new Error(NECTAR_ADMIN_ONLY);
  return { db, userId, orgId };
}

/** Questions tab: Open, Resolved or All, newest first. */
export const listNectarQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuestionsInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireNectarAdmin(context, data.organizationId, "view");
    return listQuestions(caller.db, caller.orgId, data.filter, denverYmd());
  });

/** "Questions (N open)" and the count on the Nectar nav item. */
export const countOpenNectarQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireNectarAdmin(context, data.organizationId, "view");
    return { open: await countOpenQuestions(caller.db, caller.orgId) };
  });

/** Mark resolved or Reopen. */
export const setNectarQuestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuestionStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireNectarAdmin(context, data.organizationId, "edit");
    return setQuestionStatus(caller.db, caller, data.questionId, data.status);
  });

/** AI settings: Nectar on for the agency, and each feature. */
export const getNectarSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireNectarAdmin(context, data.organizationId, "view");
    return loadNectarSettings(caller.db, caller.orgId);
  });

export const saveNectarSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireNectarAdmin(context, data.organizationId, "edit");
    return saveSettings(caller.db, caller.orgId, data);
  });
