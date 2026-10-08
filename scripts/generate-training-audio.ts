/**
 * One-time narration generator for the 30-day training. Run manually; never at build or runtime.
 *
 *   npx tsx scripts/generate-training-audio.ts            # DRY RUN (default): counts clips + characters, generates nothing
 *   npx tsx scripts/generate-training-audio.ts --run      # real run: generate, upload, write manifest
 *
 * Real run needs these in the environment (never hardcoded, never logged):
 *   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Clip text comes from buildLessonSpeech / buildCheckSpeech / buildScenarioSpeech, the same
 * functions the player calls, so a clip's hash matches exactly what the player looks up.
 * Files are named <hash-of-text>.mp3, cached in .training-audio/ (gitignored); existing
 * clips are skipped, so changing a lesson regenerates only that clip.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { thirtyDayTopicsInSowOrder } from "../src/components/training/hive-training-engine.tsx";
import {
  buildCheckSpeech,
  buildLessonSpeech,
  buildScenarioSpeech,
} from "../src/components/training/use-training-speech.ts";
import { TRAINING_AUDIO_BUCKET, hashSpeechText } from "../src/lib/training-audio.ts";

const MODEL_ID = "eleven_multilingual_v2";
const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, "../.training-audio");
const manifestPath = join(here, "../src/lib/training-audio-manifest.json");

type Clip = { text: string; hash: string; label: string };

async function collectClips(): Promise<Clip[]> {
  const byHash = new Map<string, Clip>();
  const add = async (text: string, label: string) => {
    if (!text) return;
    const hash = await hashSpeechText(text);
    if (!byHash.has(hash)) byHash.set(hash, { text, hash, label });
  };
  for (const topic of thirtyDayTopicsInSowOrder()) {
    for (const [si, step] of (topic.steps ?? []).entries() as Iterable<[number, any]>) {
      const where = `${topic.code} step ${si + 1}`;
      if (step.type === "lesson") {
        await add(buildLessonSpeech(step, null), `${where} lesson`);
        for (let d = 0; d < (step.drops?.length ?? 0); d++) {
          await add(buildLessonSpeech(step, d), `${where} drop ${d + 1}`);
        }
      } else if (step.type === "check") {
        await add(buildCheckSpeech(step), `${where} check`);
      } else if (step.type === "scenario") {
        for (let b = 0; b < (step.beats?.length ?? 0); b++) {
          await add(buildScenarioSpeech(step, b), `${where} beat ${b + 1}`);
        }
      }
    }
  }
  return [...byHash.values()];
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}.`);
    process.exit(1);
  }
  return v;
}

function readManifest(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

async function synthesize(text: string, apiKey: string, voiceId: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`ElevenLabs request failed (HTTP ${res.status})`);
  }
  throw new Error("ElevenLabs request failed");
}

async function upload(file: Buffer, hash: string, supabaseUrl: string, serviceKey: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${TRAINING_AUDIO_BUCKET}/${hash}.mp3`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: file,
  });
  // Name is a content hash, so "already exists" means the same audio is already there.
  if (res.ok || res.status === 409) return;
  const body = await res.text().catch(() => "");
  if (res.status === 400 && /already exists|Duplicate/i.test(body)) return;
  throw new Error(`Upload of ${hash}.mp3 failed (HTTP ${res.status}) ${body.slice(0, 200)}`);
}

async function main() {
  const real = process.argv.includes("--run");
  const clips = await collectClips();
  const chars = clips.reduce((n, c) => n + c.text.length, 0);

  if (!real) {
    console.log("DRY RUN — nothing generated or uploaded.");
    console.log(`Clips (unique texts): ${clips.length}`);
    console.log(`Total characters:     ${chars}`);
    console.log("Re-run with --run to generate (requires ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
    return;
  }

  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const voiceId = requireEnv("ELEVENLABS_VOICE_ID");
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  mkdirSync(cacheDir, { recursive: true });
  const old = readManifest();
  const manifest: Record<string, string> = {};
  let generated = 0;
  let uploaded = 0;
  let skipped = 0;

  for (const [n, clip] of clips.entries()) {
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${TRAINING_AUDIO_BUCKET}/${clip.hash}.mp3`;
    const file = join(cacheDir, `${clip.hash}.mp3`);
    if (old[clip.hash] && existsSync(file) === false) {
      // Already generated and uploaded on an earlier run (local cache is gone): nothing to do.
      manifest[clip.hash] = old[clip.hash];
      skipped++;
      continue;
    }
    if (!existsSync(file)) {
      writeFileSync(file, await synthesize(clip.text, apiKey, voiceId));
      generated++;
    } else skipped++;
    if (!old[clip.hash]) {
      await upload(readFileSync(file), clip.hash, supabaseUrl, serviceKey);
      uploaded++;
    }
    manifest[clip.hash] = publicUrl;
    // Write as we go so an interrupted run keeps its progress.
    writeFileSync(manifestPath, JSON.stringify({ ...old, ...manifest }, null, 2) + "\n");
    console.log(`[${n + 1}/${clips.length}] ${clip.label}`);
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Done. generated=${generated} uploaded=${uploaded} skipped=${skipped}. Manifest: ${clips.length} entries.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Failed");
  process.exit(1);
});
