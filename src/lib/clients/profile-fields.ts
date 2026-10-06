// ─── Client field registry ────────────────────────────────────────────────
// ONE source of truth bridging extraction → store → wizard → profile.
// Every tracked client field is declared here once. Extraction writes under
// the same `key` the wizard reads from and the profile displays.
//
// Storage:
//   - { kind: "column", column }     — clients.<column> (typed table)
//   - { kind: "custom" }             — custom_field_values keyed by field.key
//   - { kind: "contact", role, part } — the main client_contacts row for the role
//
// extractionKeys lets the same canonical field absorb aliases the AI/PCSP
// parser may emit (e.g. "sc_name", "coordinator_name" → the support coordinator's name).
// Contact field keys are the old flat keys the extractor emits (legacy-fields.ts).

import { primaryContact, setContactParts, type ClientContact } from "./contacts.ts";
import type { ProfileCustomsMap, ProfileField } from "./profile-field-registry.ts";

/**
 * Read the canonical value for `field` from the client row + custom-value map
 * + the client's active contacts. Returns null when the field has no value.
 */
export function getProfileFieldValue(
  client: Record<string, unknown> | null | undefined,
  customValuesByKey: ProfileCustomsMap | null | undefined,
  field: ProfileField,
  contacts: readonly ClientContact[] = [],
): string | boolean | string[] | null {
  if (field.storage.kind === "contact") {
    const c = primaryContact(contacts, field.storage.role);
    return c?.[field.storage.part] ?? null;
  }
  if (field.storage.kind === "column") {
    const v = client ? client[field.storage.column] : null;
    if (v == null) return null;
    if (field.type === "array") return Array.isArray(v) ? (v as string[]) : null;
    if (field.type === "bool") return typeof v === "boolean" ? v : null;
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return null;
  }
  const v = customValuesByKey?.[field.key];
  if (!v) return null;
  if (field.type === "bool") return typeof v.value_boolean === "boolean" ? v.value_boolean : null;
  if (field.type === "array") {
    if (!v.value_text) return null;
    return v.value_text
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return v.value_text ?? null;
}

/** True when getProfileFieldValue returns a non-empty value. */
export function profileFieldHasValue(
  client: Record<string, unknown> | null | undefined,
  customValuesByKey: ProfileCustomsMap | null | undefined,
  field: ProfileField,
  contacts: readonly ClientContact[] = [],
): boolean {
  const v = getProfileFieldValue(client, customValuesByKey, field, contacts);
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return v === true; // an explicit false is "not authorized" — still a gap to confirm
  return false;
}

/** Format a registry value for display (single string snippet). */
export function formatProfileFieldValue(
  client: Record<string, unknown> | null | undefined,
  customValuesByKey: ProfileCustomsMap | null | undefined,
  field: ProfileField,
  contacts: readonly ClientContact[] = [],
): string | null {
  const v = getProfileFieldValue(client, customValuesByKey, field, contacts);
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Persist a value for `field` to its canonical store. Throws on RLS / DB
 * failure; throws when zero rows were affected (so callers don't show a
 * green toast for a no-op write).
 */
export async function writeProfileFieldValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  orgId: string,
  clientId: string,
  field: ProfileField,
  value: string | boolean | string[] | null,
): Promise<void> {
  if (field.storage.kind === "contact") {
    const text = typeof value === "string" ? value : null;
    await setContactParts(sb, {
      organizationId: orgId,
      clientId,
      role: field.storage.role,
      parts: { [field.storage.part]: text },
    });
    return;
  }
  if (field.storage.kind === "column") {
    const col = field.storage.column;
    let payload: unknown;
    switch (field.type) {
      case "array":
        payload = Array.isArray(value)
          ? value.map((s) => String(s).trim()).filter(Boolean)
          : typeof value === "string" && value.trim()
            ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
            : [];
        break;
      case "bool":
        payload = value === true || value === "true" || value === "yes";
        break;
      case "date":
        payload = typeof value === "string" && value.trim() ? value.trim() : null;
        break;
      default:
        payload = typeof value === "string" && value.trim() ? value.trim() : null;
    }
    const { data, error } = await sb
      .from("clients")
      .update({ [col]: payload })
      .eq("id", clientId)
      .eq("organization_id", orgId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error(`Update of clients.${col} affected no rows.`);
    }
    return;
  }

  // Custom field path — upsert definition then value.
  const { data: def, error: defErr } = await sb
    .from("custom_field_definitions")
    .upsert(
      {
        organization_id: orgId,
        entity_kind: "client",
        field_key: field.key,
        field_label: field.label,
        data_type: field.type === "bool" ? "boolean" : "text",
        source: "manual",
      },
      { onConflict: "organization_id,entity_kind,field_key" },
    )
    .select("id")
    .single();
  if (defErr || !def) {
    throw new Error(defErr?.message ?? "Failed to upsert custom field definition.");
  }

  let value_text: string | null = null;
  let value_boolean: boolean | null = null;
  if (field.type === "bool") {
    value_boolean = value === true || value === "true" || value === "yes";
  } else if (field.type === "array") {
    const arr = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
        : [];
    value_text = arr.length ? arr.join(", ") : null;
  } else {
    value_text = typeof value === "string" && value.trim() ? value.trim() : null;
  }

  const { data, error } = await sb
    .from("custom_field_values")
    .upsert(
      {
        organization_id: orgId,
        definition_id: def.id,
        entity_kind: "client",
        entity_id: clientId,
        value_text,
        value_boolean,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "definition_id,entity_id" },
    )
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(`Upsert of custom_field_values for ${field.key} affected no rows.`);
  }
}
