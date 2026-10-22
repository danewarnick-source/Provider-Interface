-- Confirming a PCSP used to append its action-plan rows to clients.about_me
-- as a "From PCSP <plan year>:" heading followed by "- " lines. That copying
-- has stopped (the About card is now an approved Nectar summary). Remove those
-- blocks, keeping any text a person typed. Same rule as stripPcspBlocks() in
-- src/lib/clients/pcsp/confirm-plan.ts. Updates rows only; nothing is removed
-- from the table. A field left empty becomes NULL.

DO $$
DECLARE
  r record;
  ln text;
  kept text[];
  in_block boolean;
  result text;
BEGIN
  FOR r IN
    SELECT id, about_me FROM public.clients WHERE about_me ~ '(^|\n)\s*From PCSP'
  LOOP
    kept := ARRAY[]::text[];
    in_block := false;
    FOREACH ln IN ARRAY string_to_array(r.about_me, E'\n') LOOP
      IF btrim(ln, E' \t\r') ~ '^From PCSP\M.*:$' THEN
        in_block := true;
        CONTINUE;
      END IF;
      IF in_block AND ln LIKE '- %' THEN
        CONTINUE;
      END IF;
      in_block := false;
      kept := kept || ln;
    END LOOP;
    result := btrim(array_to_string(kept, E'\n'), E' \t\r\n');
    UPDATE public.clients SET about_me = NULLIF(result, '') WHERE id = r.id;
  END LOOP;
END $$;
