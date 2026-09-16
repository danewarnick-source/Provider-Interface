import { writeFileSync } from "node:fs";
import { platformRequirementDefs } from "../src/lib/compliance-requirement-catalog.ts";

function sqlStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNull(value: string | null): string {
  return value == null ? "NULL" : sqlStr(value);
}

const rows = platformRequirementDefs();
const values = rows
  .map(
    (row) =>
      `  (${sqlStr(row.requirementKey)}, ${sqlStr(row.subjectKind)}, ${sqlStr(row.layer)}, ${sqlStr(row.title)}, ${sqlStr(row.sourceSowCite)}, ${sqlNull(row.gateFactKey)}, ${row.defaultOn ? "true" : "false"})`,
  )
  .join(",\n");

const sql = `-- Phase 2 platform requirement_defs seed (locked DHHS91172 catalog).
-- Additive INSERT/upsert only. No DROP. No invented SOW body text.
-- Titles and citations come from src/lib/sow-obligation-catalog.ts.
-- organization_id IS NULL = platform catalog (not PHI).
-- Idempotent on requirement_key for platform rows.

WITH seed (
  requirement_key,
  subject_kind,
  layer,
  title,
  source_sow_cite,
  gate_fact_key,
  default_on
) AS (
  VALUES
${values}
)
INSERT INTO public.requirement_defs (
  organization_id,
  requirement_key,
  subject_kind,
  layer,
  title,
  source_sow_cite,
  gate_fact_key,
  default_on
)
SELECT
  NULL,
  s.requirement_key,
  s.subject_kind,
  s.layer,
  s.title,
  s.source_sow_cite,
  s.gate_fact_key,
  s.default_on
FROM seed s
ON CONFLICT (requirement_key) WHERE organization_id IS NULL
DO UPDATE SET
  subject_kind = EXCLUDED.subject_kind,
  layer = EXCLUDED.layer,
  title = EXCLUDED.title,
  source_sow_cite = EXCLUDED.source_sow_cite,
  gate_fact_key = EXCLUDED.gate_fact_key,
  default_on = EXCLUDED.default_on,
  updated_at = now();
`;

writeFileSync(
  new URL("../supabase/migrations/20260916140000_seed_platform_requirement_defs.sql", import.meta.url),
  sql,
);
console.log(`seeded ${rows.length} requirement_defs`);
for (const row of rows) {
  console.log(`${row.requirementKey}\t${row.layer}\t${row.subjectKind}`);
}
