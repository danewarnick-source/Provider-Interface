/**
 * Path params on :id UUID routes. The literal "new" is a create-page
 * placeholder — never send it to PostgREST (invalid input syntax for uuid).
 */
import { redirect } from "@tanstack/react-router";

export const ROUTE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESERVED_CREATE_IDS = new Set(["new", "create", "add"]);

export function isRouteUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && ROUTE_UUID_RE.test(value);
}

export function isReservedCreateId(value: string | null | undefined): boolean {
  return typeof value === "string" && RESERVED_CREATE_IDS.has(value.trim().toLowerCase());
}

/**
 * Redirect create placeholders (and any other non-UUID) before a query
 * casts the path segment to uuid.
 */
export function redirectUnlessUuidParam(
  id: string | undefined,
  opts: { createTo?: string; fallbackTo: string },
): void {
  if (isReservedCreateId(id) && opts.createTo) {
    throw redirect({ to: opts.createTo as never });
  }
  if (!isRouteUuid(id)) {
    throw redirect({ to: opts.fallbackTo as never });
  }
}
