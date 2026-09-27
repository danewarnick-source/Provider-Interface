-- Lane B item 4 = DB-30 (Dane-approved via Tony 2026-09-27; PR #398 removed /mcp and is live).
-- Problem: mcp_table_catalog / mcp_column_catalog views expose the full schema to any signed-in user, and
--   mcp_exec_read_sql(text) let any signed-in user run arbitrary SELECT/WITH (as invoker, under RLS).
-- Prechecks: exact signature public.mcp_exec_read_sql(text), SECURITY INVOKER. No pg_depend dependents, no other function
--   or view references it, no cron job references it or the catalogs, no views depend on the catalogs.
--   Repo main (cursor-github search_code): only docs (SQL_HANDOFF.md, DATABASE.md, SCHEMA_AUDIT.md) and historical
--   supabase/migrations; no src/ or edge-function callers. No CASCADE used.
-- Prior view ACLs (both views): {postgres=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm} (anon had none).
-- NOTE: only SELECT was revoked as approved; authenticated still holds awdDxtm on both views (INSERT/UPDATE/DELETE/
--   TRUNCATE/REFERENCES/TRIGGER/MAINTAIN). Recommend follow-up: REVOKE ALL ON both views FROM anon, authenticated.
-- Retest (rolled back): sec2 select on both catalogs -> 42501; anon -> 42501; service_role -> ok; mcp_exec_read_sql gone (0 in pg_proc).
-- ROLLBACK:
-- GRANT SELECT ON public.mcp_table_catalog, public.mcp_column_catalog TO authenticated;
/*
CREATE OR REPLACE FUNCTION public.mcp_exec_read_sql(query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  trimmed text := regexp_replace(query, ';+\s*$', '');
  result  jsonb;
BEGIN
  IF trimmed !~* '^\s*(select|with)([[:space:]]|$)' THEN
    RAISE EXCEPTION 'Only SELECT or WITH queries are allowed';
  END IF;
  IF trimmed ~* '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute|do|call|comment|security)\y' THEN
    RAISE EXCEPTION 'Only read-only SELECT/WITH queries are allowed';
  END IF;
  IF trimmed ~ ';\s*\S' THEN
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;
  EXECUTE format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', trimmed)
    INTO result;
  RETURN result;
END;
$function$;
-- prior grants: {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
REVOKE ALL ON FUNCTION public.mcp_exec_read_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_exec_read_sql(text) TO authenticated, service_role;
*/

REVOKE SELECT ON public.mcp_table_catalog, public.mcp_column_catalog FROM anon, authenticated;
DROP FUNCTION public.mcp_exec_read_sql(text);
