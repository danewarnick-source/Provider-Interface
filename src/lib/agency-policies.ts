/**
 * Agency Policies binder — contractor's own policies (SOW §1.8(4) topic P).
 *
 * The admin binder was removed in the Nectar rebuild (N4); agency policies
 * live in the Knowledge base. What is left serves old binder rows: matching a
 * new team member to a policy's audience, and opening its file from My
 * Obligations.
 */

export const AGENCY_POLICY_BUCKET = "agency-policies";
export const AGENCY_POLICY_SOURCE_SECTION = "SOW §1.8(4) topic P — contractor’s own policies";

export const POLICY_AUDIENCE_KINDS = ["everyone", "drivers", "job_code"] as const;
export type PolicyAudienceKind = (typeof POLICY_AUDIENCE_KINDS)[number];

export type AgencyPolicyRow = {
  id: string;
  organization_id: string;
  title: string;
  audience_kind: PolicyAudienceKind;
  audience_job_code: string | null;
  body_text: string | null;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size_bytes: number | null;
  obligation_id: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PolicyAudienceInput = {
  kind: PolicyAudienceKind;
  jobCode?: string | null;
};

export type StaffAudienceFacts = {
  staffTypeKeys: string[];
  position?: string | null;
  department?: string | null;
  assignedServiceCodes?: string[];
  isTransporter?: boolean;
};

export function policyFileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

const DRIVER_KEYS = ["driver", "drivers", "transporter", "transport", "mtp"];

export function staffLooksLikeDriver(facts: StaffAudienceFacts): boolean {
  if (facts.isTransporter) return true;
  const hay = [
    ...facts.staffTypeKeys,
    facts.position ?? "",
    facts.department ?? "",
    ...(facts.assignedServiceCodes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return DRIVER_KEYS.some((k) => hay.includes(k));
}

export function staffMatchesPolicyAudience(
  audience: PolicyAudienceInput,
  facts: StaffAudienceFacts,
): boolean {
  if (audience.kind === "everyone") return true;
  if (audience.kind === "drivers") return staffLooksLikeDriver(facts);
  const want = (audience.jobCode ?? "").trim().toUpperCase();
  if (!want) return false;
  const keys = facts.staffTypeKeys.map((k) => k.trim().toUpperCase());
  if (keys.includes(want)) return true;
  const codes = (facts.assignedServiceCodes ?? []).map((c) => c.trim().toUpperCase());
  return codes.includes(want);
}

export function policyMediaKind(mime: string | null | undefined, fileName?: string | null): "video" | "image" | "pdf" | "other" {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  const ext = policyFileExtension(fileName ?? "");
  if (ext === ".mp4" || ext === ".webm" || ext === ".mov") return "video";
  if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") return "image";
  if (ext === ".pdf") return "pdf";
  return "other";
}
