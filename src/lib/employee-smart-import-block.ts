/**
 * Employee Smart Import is retired. Deep links must land on the Team Members
 * import dialog — never the shared Nectar review flow.
 */

export const EMPLOYEE_SMART_IMPORT_REDIRECT = {
  to: "/dashboard/team-members",
  search: { import: 1 },
  replace: true,
} as const;

export function shouldBlockEmployeeSmartImport(mode: string | null | undefined): boolean {
  return mode === "employee";
}

export function employeeSmartImportRedirect() {
  return EMPLOYEE_SMART_IMPORT_REDIRECT;
}
