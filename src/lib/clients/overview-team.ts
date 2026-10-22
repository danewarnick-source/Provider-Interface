// Team card on the client Overview: assigned team members with "ready to
// work alone" from the same rules as Team Members (staffClientReadiness).
// Server-side; takes the caller's RLS-scoped client. When the viewer can't
// read Evidence rows, readiness is reported as unknown instead of failing.

import { denverYmd } from "@/lib/denver-date";
import { parseIsoDate, resolveHireDate } from "@/lib/evidence/due";
import type { EvidenceFileRow } from "@/lib/evidence/types";
import type { BadgeEvidenceItem } from "@/lib/team-members/badges";
import { readinessBadge, staffClientReadiness } from "@/lib/team-members/readiness";
import { groupBy, rows, type Sb } from "./list-queries";
import type { OverviewTeamMember } from "./overview";

type Profile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  hire_date: string | null;
  start_date: string | null;
};

async function evidenceFor(sb: Sb, orgId: string, staffIds: string[]) {
  const items = await rows<BadgeEvidenceItem>(
    sb
      .from("evidence_items")
      .select("*")
      .eq("organization_id", orgId)
      .eq("subject_type", "staff")
      .in("subject_id", staffIds),
  );
  const ids = items.map((i) => i.id);
  const files = ids.length
    ? await rows<EvidenceFileRow>(
        sb.from("evidence_files").select("*").eq("organization_id", orgId).in("item_id", ids),
      )
    : [];
  return { items, files };
}

/** "Full Name", falling back to first + last, then "Team member". */
export function personName(
  p: { full_name: string | null; first_name: string | null; last_name: string | null } | undefined,
): string {
  return (
    p?.full_name?.trim() || `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Team member"
  );
}

/** Names for these user ids (profiles only; never embedded in another query). */
export async function loadPeopleNames(
  sb: Sb,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const found = await rows<Pick<Profile, "id" | "full_name" | "first_name" | "last_name">>(
    sb.from("profiles").select("id, full_name, first_name, last_name").in("id", unique),
  ).catch(() => []);
  return new Map(found.map((p) => [p.id, personName(p)]));
}

export async function loadOverviewTeam(
  sb: Sb,
  orgId: string,
  clientId: string,
  hasAbi: boolean,
): Promise<OverviewTeamMember[]> {
  const assignments = await rows<{ staff_id: string; service_codes: string[] | null }>(
    sb
      .from("staff_assignments")
      .select("staff_id, service_codes")
      .eq("organization_id", orgId)
      .eq("client_id", clientId),
  );
  const staffIds = [...new Set(assignments.map((a) => a.staff_id))];
  if (!staffIds.length) return [];
  const [profiles, trainings] = await Promise.all([
    rows<Profile>(
      sb
        .from("profiles")
        .select("id, full_name, first_name, last_name, hire_date, start_date")
        .in("id", staffIds),
    ),
    rows<{ id: string }>(
      sb
        .from("client_specific_trainings")
        .select("id")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .eq("status", "published"),
    ).catch(() => []),
  ]);
  const requiredIds = trainings.map((t) => t.id);
  let evidence: Awaited<ReturnType<typeof evidenceFor>> | null = null;
  let completions: { user_id: string; ref_id: string }[] = [];
  try {
    evidence = await evidenceFor(sb, orgId, staffIds);
    completions = requiredIds.length
      ? await rows(
          sb
            .from("training_completions")
            .select("user_id, ref_id")
            .eq("topic_kind", "person")
            .eq("is_current", true)
            .in("user_id", staffIds)
            .in("ref_id", requiredIds),
        )
      : [];
  } catch {
    evidence = null;
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const codesBy = groupBy(assignments, (a) => a.staff_id);
  const itemsBy = groupBy(evidence?.items ?? [], (i) => i.subject_id);
  const filesBy = groupBy(evidence?.files ?? [], (f) => f.item_id);
  const doneBy = groupBy(completions, (c) => c.user_id);
  const today = denverYmd();

  return staffIds
    .map((id) => {
      const p = byId.get(id);
      const name = personName(p);
      const codes = [...new Set((codesBy.get(id) ?? []).flatMap((a) => a.service_codes ?? []))];
      if (!evidence) {
        return { id, name, codes, readyAlone: false, readinessLabel: "Readiness not available" };
      }
      const items = itemsBy.get(id) ?? [];
      const readiness = staffClientReadiness({
        today,
        hireDate: parseIsoDate(resolveHireDate(p?.hire_date ?? null, p?.start_date ?? null)),
        evidence: { items, files: items.flatMap((it) => filesBy.get(it.id) ?? []) },
        client: { hasAbi, behaviorSupport: false },
        personTraining: {
          requiredIds,
          completedIds: (doneBy.get(id) ?? []).map((c) => c.ref_id),
        },
      });
      return {
        id,
        name,
        codes: codes.sort(),
        readyAlone: readiness.status !== "not_ready",
        readinessLabel: readinessBadge(readiness).label,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
