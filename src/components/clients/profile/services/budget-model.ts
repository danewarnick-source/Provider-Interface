// Shapes and small helpers for a client's monthly budget.

export type BudgetSection = "income" | "expense" | "other";

export interface BudgetLine {
  id: string;
  budget_id: string;
  section: BudgetSection;
  sort_order: number;
  label: string;
  non_variable: number;
  variable: number;
  notes: string | null;
  day_of_month: number | null;
}

export interface MonthBudget {
  id: string;
  client_id: string;
  period_month: string;
  details: string | null;
}

export const BUDGET_SECTIONS: { section: BudgetSection; title: string }[] = [
  { section: "income", title: "Income" },
  { section: "expense", title: "Expenses / Needs" },
  { section: "other", title: "Other Needs / Wants / Activities / Savings" },
];

export const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** By day of the month (blank last), then the order lines were added. */
export function sortLines(lines: BudgetLine[]): BudgetLine[] {
  return [...lines].sort(
    (a, b) => (a.day_of_month ?? 99) - (b.day_of_month ?? 99) || a.sort_order - b.sort_order,
  );
}
