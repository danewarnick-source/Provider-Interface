// Pre-generated narration clips for the training player.
// Clips are keyed by a hash of the exact spoken text, so editing a lesson's
// wording simply stops matching its old clip (the player then falls back to
// the browser voice until the clip is regenerated).
// Shared by the player (browser) and scripts/generate-training-audio.ts (node):
// keep it free of DOM and node-only APIs.

export const TRAINING_AUDIO_BUCKET = "training-audio";
export const TRAINING_AUDIO_RATES = [0.9, 1, 1.15] as const;
export const DEFAULT_TRAINING_AUDIO_RATE = 1;

export type TrainingAudioManifest = Record<string, string>;

/** SHA-256 of the spoken text, first 32 hex chars. Same result in node and browsers. */
export async function hashSpeechText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

let manifestPromise: Promise<TrainingAudioManifest> | null = null;

function loadManifest(): Promise<TrainingAudioManifest> {
  if (!manifestPromise) {
    manifestPromise = import("./training-audio-manifest.json")
      .then((m) => ((m as { default?: TrainingAudioManifest }).default ?? {}) as TrainingAudioManifest)
      .catch(() => ({}));
  }
  return manifestPromise;
}

/** URL of the pre-generated clip for this exact text, or null when none exists. */
export async function lookupTrainingClip(text: string): Promise<string | null> {
  if (!text) return null;
  try {
    const [manifest, hash] = await Promise.all([loadManifest(), hashSpeechText(text)]);
    return manifest[hash] ?? null;
  } catch {
    return null;
  }
}
