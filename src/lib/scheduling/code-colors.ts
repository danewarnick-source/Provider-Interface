// Service-code → color-family map for the DSPD scheduler.
// Used everywhere a shift is rendered (cards, coverage bars, chips, NECTAR suggestions).
// Colors live as Tailwind class tokens so dark mode + theming behave; we never
// hardcode hex values into components.
import { isDailyServiceCode } from "@/lib/service-billing";

export type CodeFamily =
  | "residential"
  | "supported_living"
  | "day_supports"
  | "employment"
  | "respite"
  | "other";

const FAMILY_BY_CODE: Record<string, CodeFamily> = {
  // Residential
  HHS: "residential", RHS: "residential", PPS: "residential", ELS: "residential",
  // Supported Living
  SLH: "supported_living", SLN: "supported_living", CMP: "supported_living", CMS: "supported_living",
  // Day Supports
  DSI: "day_supports", DSG: "day_supports", DSP: "day_supports", EPR: "day_supports",
  // Employment
  SEI: "employment", SJD: "employment", SEC: "employment", SED: "employment", SEE: "employment",
  // Respite
  RP2: "respite", RP3: "respite", RP4: "respite", RP5: "respite", RPS: "respite",
};

export function familyForCode(code?: string | null): CodeFamily {
  if (!code) return "other";
  return FAMILY_BY_CODE[code.toUpperCase()] ?? "other";
}

// Hourly vs daily-unit distinction (used by Add 1:1 Segment and conflict engine).
// Delegates to the single source of truth in src/lib/service-billing.ts.
export function isDailyCode(code?: string | null) {
  return !!code && isDailyServiceCode(code.toUpperCase());
}
export function isHourlyCode(code?: string | null) {
  return !!code && !isDailyServiceCode(code.toUpperCase());
}

// Required age threshold per code (HHS staff must be ≥21).
export function minStaffAgeForCode(code?: string | null): number {
  return code?.toUpperCase() === "HHS" ? 21 : 18;
}

// Recommended max duration (hours) for service codes. Used for soft "unusual
// duration" warnings on the create dialog, not as a hard block.
export function maxRecommendedHours(code?: string | null): number | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c === "DSI") return 6;   // 1:1 day supports — atomic visit
  if (c === "SEI") return 6;
  if (c === "DSG") return 8;
  return null;
}

// Semantic Tailwind class bundles for each family. Components import these
// instead of choosing colors directly.
export const FAMILY_CLASSES: Record<CodeFamily, {
  bg: string; bgSoft: string; border: string; text: string; ring: string; bar: string;
}> = {
  // Chart order: residential → pri, supported_living → steel, day_supports →
  // acc, employment → hi, respite → accd, other → haze.
  residential: {
    bg: "bg-denim-700",   bgSoft: "bg-denim-50",   border: "border-denim-700",
    text: "text-denim-700", ring: "ring-denim-700", bar: "bg-denim-700",
  },
  supported_living: {
    bg: "bg-denim-400",    bgSoft: "bg-denim-100",    border: "border-denim-400",
    text: "text-denim-600",  ring: "ring-denim-400",  bar: "bg-denim-400",
  },
  day_supports: {
    bg: "bg-success-500", bgSoft: "bg-success-50", border: "border-success-500",
    text: "text-success-700", ring: "ring-success-500", bar: "bg-success-500",
  },
  employment: {
    bg: "bg-denim-500", bgSoft: "bg-denim-200", border: "border-denim-500",
    text: "text-denim-800", ring: "ring-denim-500", bar: "bg-denim-500",
  },
  respite: {
    bg: "bg-success-600",   bgSoft: "bg-success-100",   border: "border-success-600",
    text: "text-success-800", ring: "ring-success-600", bar: "bg-success-600",
  },
  other: {
    bg: "bg-haze-500",  bgSoft: "bg-haze-50",  border: "border-haze-500",
    text: "text-haze-700", ring: "ring-haze-500", bar: "bg-haze-500",
  },
};

export function classesForCode(code?: string | null) {
  return FAMILY_CLASSES[familyForCode(code)];
}

// Semantic CSS variable names per family (defined in src/styles.css).
// Use via `style={{ color: \`var(${cssVarForCode(code)})\` }}` when Tailwind
// classes aren't expressive enough (e.g. coverage-bar gradient stops).
export const FAMILY_VARS: Record<CodeFamily, string> = {
  residential: "--sched-residential",
  supported_living: "--sched-supported-living",
  day_supports: "--sched-day-supports",
  employment: "--sched-employment",
  respite: "--sched-respite",
  other: "--sched-other",
};
export function cssVarForCode(code?: string | null): string {
  return FAMILY_VARS[familyForCode(code)];
}
