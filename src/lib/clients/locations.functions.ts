// Add / change / end a client's extra service locations. Each runs
// assertCanManageClient first and requires a reason. A row always saves with
// coordinates: the admin's dropped pin, else the geocoded address — if that
// fails the save is refused with LOCATION_NEEDS_PIN so the dialog asks for a
// pin (never invents coordinates). Writes use the caller's RLS client.
// Ending sets archived_at; rows are never deleted.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeAddress } from "@/lib/geocode";
import { assertCanManageClient } from "./guards.server";
import { LOCATION_NEEDS_PIN, LOCATION_REASONS, cleanLocationDraft, type LocationDraft } from "./locations";
import { assertRowsChanged } from "./writes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const scope = z.object({ organizationId: z.string().uuid(), clientId: z.string().uuid() });
const draft = z.object({
  label: z.string().max(200),
  address: z.string().max(400),
  radiusFeet: z.number().int(),
  reason: z.enum(LOCATION_REASONS.map((r) => r.value) as unknown as [string, ...string[]]),
  reasonNote: z.string().max(400).nullable(),
  pin: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});

async function guard(
  context: { supabase?: unknown; userId?: string | null },
  s: z.infer<typeof scope>,
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  await assertCanManageClient({
    supabase: sb,
    actorId: context.userId,
    organizationId: s.organizationId,
    clientId: s.clientId,
    action: "edit",
  });
  return { sb, userId: context.userId };
}

function clean(d: z.infer<typeof draft>) {
  const r = cleanLocationDraft(d);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

async function coords(v: LocationDraft) {
  if (v.pin) return { latitude: v.pin.lat, longitude: v.pin.lng };
  const hit = await geocodeAddress(v.address);
  if (!hit) throw new Error(LOCATION_NEEDS_PIN);
  return { latitude: hit.lat, longitude: hit.lng };
}

export const addServiceLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ location: draft }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const v = clean(data.location);
    const { data: rows, error } = await sb
      .from("client_approved_locations")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        label: v.label,
        address: v.address,
        geofence_radius_feet: v.radiusFeet,
        reason: v.reason,
        reason_note: v.reasonNote,
        created_by: userId,
        ...(await coords(v)),
      })
      .select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(rows)[0].id as string };
  });

export const updateServiceLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ locationId: z.string().uuid(), location: draft }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const v = clean(data.location);
    const { data: before, error: readErr } = await sb
      .from("client_approved_locations")
      .select("address")
      .eq("id", data.locationId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error("That location isn't on this client.");
    const moved = (before.address ?? "").trim() !== v.address || !!v.pin;
    const { data: rows, error } = await sb
      .from("client_approved_locations")
      .update({
        label: v.label,
        address: v.address,
        geofence_radius_feet: v.radiusFeet,
        reason: v.reason,
        reason_note: v.reasonNote,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        ...(moved ? await coords(v) : {}),
      })
      .eq("id", data.locationId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: data.locationId };
  });

export const endServiceLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.extend({ locationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = await guard(context, data);
    const { data: rows, error } = await sb
      .from("client_approved_locations")
      .update({ archived_at: new Date().toISOString(), archived_by: userId })
      .eq("id", data.locationId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .is("archived_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: data.locationId };
  });
