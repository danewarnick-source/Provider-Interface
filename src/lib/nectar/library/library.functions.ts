// Knowledge base library server functions (N3). Screens: the admin Knowledge
// base (N4) and the team member Policies tab (N6). Each one checks who is
// asking on the server first (access.server.ts): owners and agency-wide
// admins with agency_settings view/edit for the library, any active member
// for their own policies, "Mark as reviewed" and a cited state rule section.
// Then it reads or writes on the caller's own data client.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { denverYmd } from "@/lib/denver-date";
import { requireLibraryAdmin, requireLibraryMember } from "./access.server";
import {
  AudienceInput,
  CreateDraftInput,
  DocInput,
  NewVersionInput,
  OrgInput,
  QuestionInput,
  SaveDraftInput,
  SectionInput,
  StaffRecordInput,
  StateRuleInput,
  TogglesInput,
} from "./library-input";
import {
  archiveDocument,
  publishDocument,
  publishNewVersion,
  refreshLibraryIndex,
} from "./library-publish.server";
import {
  readDraftQuestion,
  readLibrary,
  readLibraryDocument,
  readRequiredSlots,
  readStateRule,
  readStateRuleSection,
} from "./library-read.server";
import { createDraft, saveDraft, setAgencyToggles, setAudience } from "./library-write.server";
import {
  markReviewed,
  readPolicyForMember,
  readReviewMatrix,
  readStaffRecord,
} from "./reviews.server";

/** Library tab: the four groups with each document's status, owner, review date and reviews. */
export const listLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readLibrary(caller.db, caller.orgId, denverYmd());
  });

/** Document view: versions, sections, who it's for and each person's review of this version. */
export const getLibraryDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readLibraryDocument(caller.db, caller.orgId, data.documentId, denverYmd());
  });

/** A state rule, read-only: loaded by PI for every agency (N4). */
export const getStateRuleDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StateRuleInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readStateRule(caller.db, data.stateRuleId);
  });

/** The question a New document is prefilled from ("Add to library", N4/N6). */
export const getLibraryDraftQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuestionInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readDraftQuestion(caller.db, caller.orgId, data.questionId);
  });

/** New document: typed text or an uploaded file. Saves as Draft. */
export const createLibraryDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateDraftInput.parse(input))
  .handler(async ({ data, context }) =>
    createDraft(await requireLibraryAdmin(context, data.organizationId, "edit"), data),
  );

export const saveLibraryDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveDraftInput.parse(input))
  .handler(async ({ data, context }) =>
    saveDraft(await requireLibraryAdmin(context, data.organizationId, "edit"), data),
  );

/** Draft → Published, and into Nectar search before this returns. */
export const publishLibraryDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocInput.parse(input))
  .handler(async ({ data, context }) =>
    publishDocument(
      await requireLibraryAdmin(context, data.organizationId, "edit"),
      data.documentId,
    ),
  );

/** A new published version; the old one is archived and everyone it's for is asked again. */
export const publishLibraryVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NewVersionInput.parse(input))
  .handler(async ({ data, context }) =>
    publishNewVersion(await requireLibraryAdmin(context, data.organizationId, "edit"), data),
  );

export const archiveLibraryDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocInput.parse(input))
  .handler(async ({ data, context }) =>
    archiveDocument(
      await requireLibraryAdmin(context, data.organizationId, "edit"),
      data.documentId,
    ),
  );

/** Who it's for: all team members, or only the people checked. */
export const setLibraryAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AudienceInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "edit");
    return setAudience(caller, data.documentId, data.audienceAll, data.userIds);
  });

/** Required policies tab: slot status, "X of Y" and the two agency answers. */
export const getRequiredPolicies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readRequiredSlots(caller.db, caller.orgId, denverYmd());
  });

export const setRequiredPolicyAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TogglesInput.parse(input))
  .handler(async ({ data, context }) =>
    setAgencyToggles(await requireLibraryAdmin(context, data.organizationId, "edit"), data),
  );

/** Reviews tab: team members × published policies and procedures. */
export const getReviewMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryAdmin(context, data.organizationId, "view");
    return readReviewMatrix(caller.db, caller.orgId);
  });

/** A person's printable record (admins), or a team member's own Policies list (no userId). */
export const getStaffReviewRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StaffRecordInput.parse(input))
  .handler(async ({ data, context }) => {
    const self = !data.userId || data.userId === context.userId;
    const caller = self
      ? await requireLibraryMember(context, data.organizationId)
      : await requireLibraryAdmin(context, data.organizationId, "view");
    return readStaffRecord(caller.db, caller.orgId, data.userId ?? caller.userId);
  });

/** A team member opening a published policy meant for them. */
export const getPolicyForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryMember(context, data.organizationId);
    return readPolicyForMember(caller.db, caller.orgId, data.documentId, caller.userId);
  });

/** A state rule section Nectar cited, read-only, for any active member (N6, Decision 7). */
export const getStateRuleSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SectionInput.parse(input))
  .handler(async ({ data, context }) => {
    const caller = await requireLibraryMember(context, data.organizationId);
    return readStateRuleSection(caller.db, data.sectionId);
  });

/** "Mark as reviewed": any active member the published version is for; idempotent per version. */
export const markPolicyReviewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocInput.parse(input))
  .handler(async ({ data, context }) =>
    markReviewed(await requireLibraryMember(context, data.organizationId), data.documentId),
  );

/** Puts published documents not yet in Nectar search (and missing embeddings) into it. */
export const refreshKnowledgeSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) =>
    refreshLibraryIndex(await requireLibraryAdmin(context, data.organizationId, "edit")),
  );
