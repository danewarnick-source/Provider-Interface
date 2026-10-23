// Minimal chainable Supabase stand-in for unit tests. Each table maps to the
// rows its query resolves to; filters are recorded, not applied.
type Result = { data: unknown; error: { message: string } | null };

export function fakeDb(tables: Record<string, unknown>, failTables: string[] = []) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  function builder(table: string, op = "select", payload?: unknown) {
    const result = (): Result =>
      failTables.includes(table)
        ? { data: null, error: { message: `${table} failed` } }
        : { data: tables[table] ?? null, error: null };
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "neq", "lte", "gte", "lt", "gt", "in", "not", "is", "order", "limit"]) {
      b[m] = chain;
    }
    b.maybeSingle = () => {
      const r = result();
      return Promise.resolve({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data });
    };
    b.single = b.maybeSingle;
    b.then = (resolve: (r: Result) => unknown) => Promise.resolve(result()).then(resolve);
    calls.push({ table, op, payload });
    return b;
  }
  const db = {
    from(table: string) {
      return {
        select: () => builder(table),
        insert: (payload: unknown) => builder(table, "insert", payload),
      };
    },
    // RPCs resolve like tables keyed "rpc:<name>"; unset ones return no rows.
    rpc(name: string) {
      return builder(`rpc:${name}`, "rpc");
    },
  };
  return { db, calls };
}
