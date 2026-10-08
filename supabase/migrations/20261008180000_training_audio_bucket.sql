-- Public-read bucket for pre-generated training narration (mp3).
-- Files are named <hash of spoken text>.mp3 and uploaded by scripts/generate-training-audio.ts
-- with the service role key. Nothing here is PHI or org data: it is the shared course narration.
-- Public buckets serve objects by URL without an RLS policy; no insert/update/delete policies are
-- created, so only the service role can write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-audio',
  'training-audio',
  true,
  10485760,
  ARRAY['audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;
