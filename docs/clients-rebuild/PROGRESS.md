# Clients rebuild — progress

One short report per prompt. A new session continues from the first prompt not marked merged.

## Baseline (main @ start of run)
- Supabase live `dhrrukdcigiiqksibdfb`: reachable via MCP, migrations can be applied.
- `npx tsc --noEmit`: 203 errors.
- `npm run test:unit`: 1543 pass, 5 fail already on main (Lambda build path collision, NECTAR onboarding agency setup gate, Admin notification bell, confirm/webhook shared upsert, SOW index). "Passing" for each prompt = no new failures beyond these.
