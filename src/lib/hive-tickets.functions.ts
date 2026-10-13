import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// PI Executive NECTAR — platform ticket queue.
// Tickets are real DB rows, not seeded sample data. A PI executive files
// them for platform issues (permission inconsistencies, UX gaps). Older
// rows with source "auto" came from the requirements pipeline, which was
// removed in the Nectar rebuild (N2).
// ============================================================

const CATEGORY = [
  "structural_gap",
  "parsing_failure",
  "expansion_need",
  "mapping_gap",
  "permission_inconsistency",
  "other",
] as const;
const SEVERITY = ["low", "medium", "high", "critical"] as const;
const STATUS = ["new", "in_progress", "resolved"] as const;

// ---------------------------------------------------------------
// PI-exec-scoped reads/writes. RLS already restricts these to
// is_hive_executive — the user-scoped supabase client is fine.
// ---------------------------------------------------------------

export const listPlatformTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    if (!supabase) return { tickets: [] };
    const { data, error } = await supabase
      .from("hive_platform_tickets")
      .select(
        "id, triggering_org_id, triggering_org_name, title, detail, category, severity, status, source, event_kind, event_ref, affected_orgs, resolution, audit, detected_at, created_at, updated_at",
      )
      .order("detected_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

export const createPlatformTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        triggeringOrgId: z.string().uuid().nullable().optional(),
        triggeringOrgName: z.string().min(1).max(240),
        title: z.string().min(3).max(240),
        detail: z.string().max(4000).default(""),
        category: z.enum(CATEGORY).default("other"),
        severity: z.enum(SEVERITY).default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { id: null };
    const audit = [
      {
        ts: new Date().toISOString(),
        actor: "PI Exec",
        action: "Ticket filed manually",
      },
    ];
    const { data: row, error } = await supabase
      .from("hive_platform_tickets")
      .insert({
        triggering_org_id: data.triggeringOrgId ?? null,
        triggering_org_name: data.triggeringOrgName,
        title: data.title,
        detail: data.detail,
        category: data.category,
        severity: data.severity,
        status: "new",
        source: "manual",
        affected_orgs: 1,
        audit,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const updatePlatformTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            title: z.string().min(3).max(240).optional(),
            detail: z.string().max(4000).optional(),
            category: z.enum(CATEGORY).optional(),
            severity: z.enum(SEVERITY).optional(),
            status: z.enum(STATUS).optional(),
            resolution: z.record(z.string(), z.unknown()).optional(),
            appendAudit: z
              .object({
                actor: z.string().min(1).max(80),
                action: z.string().min(1).max(240),
                note: z.string().max(500).optional(),
              })
              .optional(),
          })
          .refine((p) => Object.keys(p).length > 0, "empty patch"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!supabase) return { ok: false };
    // Pull current audit so we can append immutably.
    const { data: cur, error: cErr } = await supabase
      .from("hive_platform_tickets")
      .select("audit")
      .eq("id", data.id)
      .single();
    if (cErr) throw new Error(cErr.message);

    const patch: Record<string, unknown> = {};
    if (data.patch.title !== undefined) patch.title = data.patch.title;
    if (data.patch.detail !== undefined) patch.detail = data.patch.detail;
    if (data.patch.category !== undefined) patch.category = data.patch.category;
    if (data.patch.severity !== undefined) patch.severity = data.patch.severity;
    if (data.patch.status !== undefined) patch.status = data.patch.status;
    if (data.patch.resolution !== undefined)
      patch.resolution = data.patch.resolution;
    if (data.patch.appendAudit) {
      const prev = Array.isArray(cur?.audit) ? (cur!.audit as unknown[]) : [];
      patch.audit = [
        ...prev,
        { ts: new Date().toISOString(), ...data.patch.appendAudit },
      ];
    }

    const { error } = await supabase
      .from("hive_platform_tickets")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
