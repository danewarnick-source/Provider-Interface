// The class of a pressed / unpressed choice button (Add shift's steps, the
// rotation editor's fields).
export const choice = (on: boolean) =>
  `min-h-11 rounded-md border px-3 text-[13px] font-semibold ${on ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white" : "border-[var(--hive-border)] hover:bg-[var(--hive-hover)]"}`;
