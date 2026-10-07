// The plain name of a service code ("DSI" → "Day Supports Individual"), or
// null when the code isn't in the list.

import { EVV_SERVICE_CODES } from "@/lib/evv-codes";

export function codeName(code: string): string | null {
  const label = EVV_SERVICE_CODES.find((c) => c.code === code.trim().toUpperCase())?.label;
  return label?.split(" — ")[1] ?? null;
}
