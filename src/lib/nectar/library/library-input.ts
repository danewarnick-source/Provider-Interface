// Inputs of the Knowledge base library server functions (N3). Pure (zod
// only), so node --test can import it.

import { z } from "zod";
import { AGENCY_GROUPS } from "./library.ts";
import { LIBRARY_MAX_BYTES } from "./uploads.ts";

const Uuid = z.string().uuid();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-01-31.");
const Title = z.string().trim().min(1, "Give the document a name.").max(200);
const Text = z.string().max(400_000, "That text is too long. Upload it as a file instead.");
const Owner = z.string().trim().max(120).nullable().optional();
const Slot = z.string().min(1).max(60).nullable().optional();

/** A file the browser already sent to storage with a signed upload URL. */
export const UploadedFile = z.object({
  path: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).nullable().optional(),
  sizeBytes: z.number().int().min(1).max(LIBRARY_MAX_BYTES),
});
export type UploadedFile = z.infer<typeof UploadedFile>;

export const OrgInput = z.object({ organizationId: Uuid });
export const DocInput = OrgInput.extend({ documentId: Uuid });

const hasText = (text: string | undefined) => !!text && text.trim().length > 0;

export const CreateDraftInput = OrgInput.extend({
  title: Title,
  group: z.enum(AGENCY_GROUPS),
  requiredSlot: Slot,
  ownerName: Owner,
  reviewDue: Day.nullable().optional(),
  text: Text.optional(),
  upload: UploadedFile.optional(),
  /** "Add to library" from the Questions tab: the question this draft resolves. */
  resolvesQuestionId: Uuid.optional(),
}).refine((d) => hasText(d.text) !== !!d.upload, {
  message: "Type the text or upload a file (one, not both).",
});
export type CreateDraftInput = z.infer<typeof CreateDraftInput>;

export const SaveDraftInput = DocInput.extend({
  title: Title.optional(),
  group: z.enum(AGENCY_GROUPS).optional(),
  requiredSlot: Slot,
  ownerName: Owner,
  reviewDue: Day.nullable().optional(),
  text: Text.optional(),
  upload: UploadedFile.optional(),
}).refine((d) => !(d.text !== undefined && d.upload), {
  message: "Type the text or upload a file (one, not both).",
});
export type SaveDraftInput = z.infer<typeof SaveDraftInput>;

export const NewVersionInput = DocInput.extend({
  title: Title.optional(),
  ownerName: Owner,
  reviewDue: Day.nullable().optional(),
  text: Text.optional(),
  upload: UploadedFile.optional(),
}).refine((d) => hasText(d.text) !== !!d.upload, {
  message: "Type the new text or upload a new file (one, not both).",
});
export type NewVersionInput = z.infer<typeof NewVersionInput>;

export const AudienceInput = DocInput.extend({
  audienceAll: z.boolean(),
  userIds: z.array(Uuid).max(5000).default([]),
});

export const TogglesInput = OrgInput.extend({
  providesTransportation: z.boolean().optional(),
  managesClientMoney: z.boolean().optional(),
});

export const StaffRecordInput = OrgInput.extend({ userId: Uuid.optional() });

export const UploadUrlInput = OrgInput.extend({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).nullable().optional(),
  sizeBytes: z.number().int().min(1).max(LIBRARY_MAX_BYTES),
});
