-- DB-30 follow-up (Dane go via Tony 2026-09-27): remove all remaining anon/authenticated privileges on MCP catalog views.
-- service_role and owner unchanged. Rollback: re-GRANT the specific privileges if ever needed.
REVOKE ALL ON public.mcp_table_catalog, public.mcp_column_catalog FROM anon, authenticated;
