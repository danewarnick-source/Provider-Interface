// Small display helpers shared by the Scheduling settings tabs (no components,
// so the tab files stay fast-refresh friendly).
import type { ProfileTone } from "@/components/profile-shell/tones";
import type { Strength } from "@/lib/scheduler/rules-types";

export const READ_ONLY_REASON = "Only the owner can change scheduling settings.";
export const STRENGTH_TONE: Record<Strength, ProfileTone> = {
  off: "neutral",
  warn: "info",
  reason: "profile",
  block: "danger",
};

/** 21 → "9p", 7 → "7a". */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 === 0 ? 12 : hh % 12}${hh < 12 ? "a" : "p"}`;
}
