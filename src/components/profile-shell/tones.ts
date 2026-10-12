// Tones shared by the profile side menu and the client profile cards.
// Denim status rules (src/styles/hive-theme.css): warn → warning, danger →
// danger, ok → green accent, info → pri. "profile" is the brand tone: green
// icon tiles, but its pills mark "waiting / needs doing", so they read as warning.

export type ProfileTone = "profile" | "info" | "ok" | "warn" | "danger" | "neutral";

/** Icon tile fill + icon color. */
export const TONE_TILE: Record<ProfileTone, string> = {
  profile: "bg-acct text-accd",
  info: "bg-pt text-pri",
  ok: "bg-acct text-accd",
  warn: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  neutral: "bg-pt0 text-deep",
};

/** Pill fill, text and border. */
export const TONE_TAG: Record<ProfileTone, string> = {
  profile: "border-warning-200 bg-warning-50 text-warning-700",
  info: "border-pt2 bg-pt text-pri",
  ok: "border-acctb bg-acct text-accd",
  warn: "border-warning-200 bg-warning-50 text-warning-700",
  danger: "border-danger-200 bg-danger-50 text-danger-700",
  neutral: "border-line bg-pt0 text-body",
};
