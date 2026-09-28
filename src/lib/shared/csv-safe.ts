/**
 * OWASP CSV injection: a cell Excel would treat as a formula gets a leading
 * single quote. Triggers are = + - @, tab, and carriage return.
 */
const CSV_FORMULA_LEAD = /^[=+\-@\t\r]/;

export function neutralizeCsvFormula(value: string): string {
  return CSV_FORMULA_LEAD.test(value) ? `'${value}` : value;
}

export function neutralizeCsvFields(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) out[key] = neutralizeCsvFormula(value ?? "");
  return out;
}
