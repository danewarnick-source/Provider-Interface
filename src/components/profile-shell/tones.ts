// Tones shared by the profile side menu and the client profile cards.
// Existing theme tokens only (src/styles/hive-theme.css).

export type ProfileTone = "profile" | "info" | "ok" | "danger" | "neutral";

/** Icon tile fill + icon color. */
export const TONE_TILE: Record<ProfileTone, string> = {
  profile: "bg-hive-gold-soft text-hive-ink",
  info: "bg-[var(--hive-info-soft)] text-[var(--hive-info-fg)]",
  ok: "bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]",
  danger: "bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]",
  neutral: "bg-[var(--hive-muted-surface)] text-hive-ink",
};

/** Pill fill, text and border. */
export const TONE_TAG: Record<ProfileTone, string> = {
  profile: "border-hive-gold/40 bg-hive-gold-soft text-hive-ink",
  info: "border-[var(--hive-info)]/30 bg-[var(--hive-info-soft)] text-[var(--hive-info-fg)]",
  ok: "border-[var(--hive-ok)]/30 bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]",
  danger:
    "border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]",
  neutral: "border-hive-border bg-[var(--hive-muted-surface)] text-hive-ink",
};
