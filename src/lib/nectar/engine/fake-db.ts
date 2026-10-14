// Test support for the Nectar engine (N5): an in-memory stand-in for the
// Supabase data client, so the engine and its context loaders run in
// node --test against fixture rows. It applies the same filters PostgREST
// would (eq, neq, in, is, not is null, gte, lt, order, limit, range) and logs
// every call, so tests can check what was read and with which filters.
// Used only by tests; no fixture holds real people's data.

import type { NectarDb } from "./ask-types.ts";

export type Row = Record<string, unknown>;
type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
};
export type RpcHandler = (args: Record<string, unknown>) => Result | Promise<Result>;

export interface FakeCall {
  table: string;
  op: "select" | "insert" | "update" | "rpc";
  filters: Array<[string, string, unknown]>;
  payload?: unknown;
}

export interface FakeDbOptions {
  tables?: Record<string, Row[]>;
  rpc?: Record<string, RpcHandler>;
  /** Reads of these tables return an error, as RLS or a missing table would. */
  failing?: string[];
}

type Filter = { desc: [string, string, unknown]; test: (row: Row) => boolean };

class FakeQuery implements PromiseLike<Result> {
  private op: FakeCall["op"] = "select";
  private columns: string[] | null = null;
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private max: number | null = null;
  private from = 0;
  private want: "many" | "single" | "maybe" = "many";
  private payload: unknown;
  private countOnly = false;
  private readonly table: string;
  private readonly db: FakeDb;

  constructor(table: string, db: FakeDb) {
    this.table = table;
    this.db = db;
  }

  select(columns?: string, opts?: { count?: string; head?: boolean }) {
    this.columns = columns ? columns.split(",").map((c) => c.trim()) : null;
    this.countOnly = !!opts?.head;
    return this;
  }
  private add(method: string, column: string, value: unknown, test: (v: unknown) => boolean) {
    this.filters.push({ desc: [method, column, value], test: (row) => test(row[column]) });
    return this;
  }
  eq(c: string, v: unknown) {
    return this.add("eq", c, v, (x) => x === v);
  }
  neq(c: string, v: unknown) {
    return this.add("neq", c, v, (x) => x !== v);
  }
  in(c: string, v: unknown[]) {
    return this.add("in", c, v, (x) => v.includes(x));
  }
  is(c: string, v: null) {
    return this.add("is", c, v, (x) => x === null || x === undefined);
  }
  gte(c: string, v: string) {
    return this.add("gte", c, v, (x) => String(x) >= v);
  }
  lt(c: string, v: string) {
    return this.add("lt", c, v, (x) => String(x) < v);
  }
  not(c: string, op: string, v: unknown) {
    if (op !== "is" || v !== null) throw new Error(`fake db: unsupported not(${op})`);
    return this.add("not.is", c, v, (x) => x !== null && x !== undefined);
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  range(from: number, to: number) {
    this.from = from;
    this.max = to - from + 1;
    return this;
  }
  single() {
    this.want = "single";
    return this;
  }
  maybeSingle() {
    this.want = "maybe";
    return this;
  }
  insert(payload: unknown) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(patch: unknown) {
    this.op = "update";
    this.payload = patch;
    return this;
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onFulfilled, onRejected);
  }

  private run(): Result {
    this.db.calls.push({
      table: this.table,
      op: this.op,
      filters: this.filters.map((f) => f.desc),
      payload: this.payload,
    });
    if (this.db.failing.has(this.table)) return { data: null, error: { message: "denied" } };
    const rows = (this.db.tables[this.table] ??= []);
    if (this.op === "insert") {
      const added = [this.payload].flat().map((r) => ({ id: crypto.randomUUID(), ...(r as Row) }));
      rows.push(...added);
      return this.shape(added);
    }
    const matched = rows.filter((r) => this.filters.every((f) => f.test(r)));
    if (this.op === "update") {
      for (const r of matched) Object.assign(r, this.payload as Row);
      // .update(...).select(cols) returns the changed rows, as PostgREST does.
      return this.columns ? this.shape(matched) : { data: null, error: null };
    }
    if (this.countOnly) return { data: null, error: null, count: matched.length };
    const sorted = [...matched].sort((a, b) => {
      for (const o of this.orders) {
        const x = String(a[o.column] ?? "");
        const y = String(b[o.column] ?? "");
        if (x !== y) return (x < y ? -1 : 1) * (o.ascending ? 1 : -1);
      }
      return 0;
    });
    const page = sorted.slice(this.from, this.max === null ? undefined : this.from + this.max);
    return this.shape(page);
  }

  private shape(rows: Row[]): Result {
    const cols = this.columns;
    const out = cols
      ? rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])))
      : rows;
    if (this.want === "many") return { data: out, error: null };
    if (this.want === "single" && out.length !== 1)
      return { data: null, error: { message: "not one row" } };
    return { data: out[0] ?? null, error: null };
  }
}

export class FakeDb {
  calls: FakeCall[] = [];
  tables: Record<string, Row[]>;
  failing: Set<string>;
  private handlers: Record<string, RpcHandler>;

  constructor(opts: FakeDbOptions = {}) {
    this.tables = structuredClone(opts.tables ?? {});
    this.failing = new Set(opts.failing ?? []);
    this.handlers = opts.rpc ?? {};
  }

  from(table: string) {
    return new FakeQuery(table, this);
  }

  /** Adds or replaces an rpc handler (handlers may read this.tables). */
  onRpc(name: string, handler: RpcHandler): this {
    this.handlers[name] = handler;
    return this;
  }

  async rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
    this.calls.push({ table: name, op: "rpc", filters: [], payload: args });
    const handler = this.handlers[name];
    if (!handler) return { data: null, error: { message: `no rpc ${name}` } };
    return handler(args);
  }

  /** This instance as the engine's data client type. */
  get client(): NectarDb {
    return this as unknown as NectarDb;
  }

  /** Calls to one table (or rpc), in order. */
  callsTo(table: string): FakeCall[] {
    return this.calls.filter((c) => c.table === table);
  }
}
