// Pure access resolution. Same rules as SQL access_categories() / access_has_category().

import { CATEGORY_IDS, type CategoryId, type CategoryMap, type CategoryValue } from "./categories.ts";
import type { AccessLevel } from "./levels.ts";
import { PERMISSION_KEYS, isPermission } from "./permission-keys.ts";

export interface AccessInput {
  level: AccessLevel | null | undefined;
  presetCategories?: unknown;
  overrides?: unknown;
}

const RANK: Record<CategoryValue, number> = { off: 0, view: 1, edit: 2 };

function asCategoryMap(raw: unknown): CategoryMap {
  if (!raw || typeof raw !== "object") return {};
  const out: CategoryMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((CATEGORY_IDS as readonly string[]).includes(k) && (v === "off" || v === "view" || v === "edit")) {
      out[k as CategoryId] = v;
    }
  }
  return out;
}

/** Preset + per-person overrides. Owners get Edit everywhere; Agency settings is Owner-only. */
export function effectiveCategories(input: AccessInput): Record<CategoryId, CategoryValue> {
  const all = {} as Record<CategoryId, CategoryValue>;
  if (!input.level) {
    CATEGORY_IDS.forEach((id) => (all[id] = "off"));
    return all;
  }
  if (input.level === "owner") {
    CATEGORY_IDS.forEach((id) => (all[id] = "edit"));
    return all;
  }
  const merged = { ...asCategoryMap(input.presetCategories), ...asCategoryMap(input.overrides) };
  CATEGORY_IDS.forEach((id) => (all[id] = merged[id] ?? "off"));
  all.agency_settings = "off";
  return all;
}

export function hasCategory(
  cats: Record<CategoryId, CategoryValue>,
  id: CategoryId,
  min: "view" | "edit" = "view",
): boolean {
  return RANK[cats[id]] >= RANK[min];
}

export function hasPermission(cats: Record<CategoryId, CategoryValue>, key: string): boolean {
  if (!isPermission(key)) return false;
  const rule = PERMISSION_KEYS[key];
  return !!rule && hasCategory(cats, rule[0], rule[1]);
}

/** Keeps only the settings that differ from the preset, so overrides stay small and readable. */
export function diffOverrides(
  preset: unknown,
  wanted: Partial<Record<CategoryId, CategoryValue>>,
): CategoryMap {
  const base = asCategoryMap(preset);
  const out: CategoryMap = {};
  for (const id of CATEGORY_IDS) {
    if (id === "agency_settings" || wanted[id] === undefined) continue;
    if ((base[id] ?? "off") !== wanted[id]) out[id] = wanted[id];
  }
  return out;
}

export { asCategoryMap };
