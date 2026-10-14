// State rules, loaded by PI once for every agency (N4, Decision 6). Pure: no
// Supabase, no aliases, so node --test can import it.
//
// A hive executive uploads a rule's file, or a new version of it, on
// /dashboard/hive-exec/knowledge. The file goes straight to the private
// state-rules bucket with a signed upload URL; state-rules.server.ts reads its
// text, publishes the version (the old one is archived, never deleted) and
// puts its sections in Nectar search.

import { z } from "zod";
import { safeFileName } from "./uploads.ts";

export const STATE_RULES_BUCKET = "state-rules";
export const STATE_RULE_MAX_BYTES = 25 * 1024 * 1024;
/** Time one call spends on embeddings; the screen calls again until every section has one. */
export const STATE_RULE_EMBED_BUDGET_MS = 8_000;

export const STATE_RULE_NO_TEXT =
  "That file has no readable text. Upload a PDF or Word file with selectable text.";

/** A state rule needs text Nectar can read: PDF, Word (.docx) or text, up to 25 MB. */
export function stateRuleFileProblem(file: { fileName: string; sizeBytes: number }): string | null {
  if (!/\.(pdf|docx|txt|md)$/i.test(file.fileName))
    return "Upload a PDF, Word (.docx) or text file.";
  if (file.sizeBytes <= 0) return "That file is empty.";
  if (file.sizeBytes > STATE_RULE_MAX_BYTES) return "That file is larger than 25 MB.";
  return null;
}

/** Where an uploaded rule file lives in the state-rules bucket: "<id>-<name>". */
export function stateRuleObjectPath(fileName: string, id: string): string {
  return `${id}-${safeFileName(fileName)}`;
}

/** A path the browser sends back must be one stateRuleObjectPath handed out. */
export function isStateRulePath(path: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]+$/.test(
    path,
  );
}

/** A new rule's key from its title: "R539-4 Behavior Supports" -> "r539-4-behavior-supports". */
export function ruleKeyFor(title: string): string {
  const key = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return key || "state-rule";
}

export interface CurrentRule {
  id: string;
  rule_key: string;
  title: string;
  version: number;
  effective_from: string | null;
}

/** The new version's columns: a new rule starts at v1; a replacement is the next version of its rule. */
export function planStateRuleVersion(
  current: CurrentRule | null,
  input: { title?: string; effectiveFrom?: string | null },
): { rule_key: string; title: string; version: number; effective_from: string | null } {
  const title = input.title?.trim() || current?.title || "";
  return {
    rule_key: current?.rule_key ?? ruleKeyFor(title),
    title,
    version: current ? current.version + 1 : 1,
    effective_from:
      input.effectiveFrom !== undefined ? input.effectiveFrom : (current?.effective_from ?? null),
  };
}

/** How much of a version is in Nectar search. */
export function searchProgress(sections: number, embedded: number) {
  const pending = Math.max(0, sections - embedded);
  const label =
    sections === 0
      ? "Not in Nectar search yet"
      : pending === 0
        ? `${sections} sections in Nectar search`
        : `${sections} sections in Nectar search · ${pending} still being prepared`;
  return { sections, embedded, pending, label };
}

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-07-01.");

export const StateRuleUploadUrlInput = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(255).nullable().optional(),
  sizeBytes: z.number().int().min(1).max(STATE_RULE_MAX_BYTES),
});

export const PublishStateRuleInput = z
  .object({
    /** Replace this rule with a new version; leave out to add a new rule. */
    ruleKey: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
    title: z.string().trim().min(1, "Give the state rule a name.").max(200).optional(),
    effectiveFrom: Day.nullable().optional(),
    upload: StateRuleUploadUrlInput.extend({ path: z.string().min(1).max(400) }),
  })
  .refine((d) => !!d.ruleKey || !!d.title, { message: "Give the state rule a name." });
export type PublishStateRuleInput = z.infer<typeof PublishStateRuleInput>;

export const StateRuleIdInput = z.object({ stateRuleId: z.string().uuid() });
