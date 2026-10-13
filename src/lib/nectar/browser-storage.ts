// Nectar keeps nothing in browser storage. Keys that earlier builds wrote are
// removed on load, so old question history doesn't linger on shared devices.
// (Billing Nectar's own keys are left alone; it is out of this rebuild.)

export const LEGACY_NECTAR_STORAGE_KEYS = ["hive.nectar.helpHistory"] as const;

type KeyStore = { removeItem(key: string): void };

function browserLocalStorage(): KeyStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Remove the old Nectar keys. A no-op without storage (SSR, blocked storage). */
export function clearLegacyNectarStorage(
  storage: KeyStore | null = browserLocalStorage(),
): void {
  if (!storage) return;
  for (const key of LEGACY_NECTAR_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* storage blocked; nothing to clean */
    }
  }
}
