// Mock fixtures still describe people with legacy role names; the app reads
// organization_members.access_level + the embedded access_presets row. Map once
// here so every mock stays in sync. Presets mirror the DB seeds (access_seed_presets).
type Level = "owner" | "admin" | "staff";

const LEVEL_BY_ROLE: Record<string, Level> = {
  admin: "owner",
  super_admin: "owner",
  program_manager: "admin",
  manager: "admin",
};

const SEED_PRESETS = {
  staff: { name: "DSP", home_page: "/employee", access_scope: "self", categories: { phone_app: "edit" } },
  admin: {
    name: "Program Manager",
    home_page: "/dashboard",
    access_scope: "agency",
    categories: {
      hrc: "edit",
      hosts: "view",
      billing: "view",
      clients: "edit",
      payroll: "view",
      reports: "view",
      incidents: "edit",
      phone_app: "edit",
      scheduling: "edit",
      timesheets: "edit",
      staff_hiring: "edit",
      staff_roster: "edit",
      documentation: "edit",
      client_medical: "view",
      staff_compliance: "edit",
    },
  },
} as const;

export function levelForRole(role: unknown): Level {
  return LEVEL_BY_ROLE[String(role)] ?? "staff";
}

export function withAccessLevel<T extends Record<string, unknown>>(row: T): T & { access_level: Level } {
  const level = (row.access_level as Level | undefined) ?? levelForRole(row.role);
  const preset = level === "owner" ? null : SEED_PRESETS[level];
  return {
    ...row,
    access_level: level,
    access_scope: (row.access_scope as string | undefined) ?? preset?.access_scope ?? "agency",
    access_preset_id: preset ? `preset-${level}` : null,
    access_overrides: row.access_overrides ?? {},
    access_presets: preset
      ? { name: preset.name, categories: preset.categories, home_page: preset.home_page }
      : null,
  };
}
