/**
 * Staff intake field config. Wizards read organizations.feature_config.staff_intake_fields
 * through normalizeConfig. The roster Settings sheet that used to edit this JSON is gone;
 * the stored config is left in place.
 */

export type CustomFieldType = "text" | "date" | "yesno" | "number" | "dropdown";

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  at_hire: boolean;
}

export interface ToggleFieldConfig {
  enabled: boolean;
  options?: string[];
}

export interface StaffIntakeFieldsConfig {
  staff_type: ToggleFieldConfig;
  department: ToggleFieldConfig;
  employee_id: ToggleFieldConfig;
  worker_type: ToggleFieldConfig;
  custom_fields: CustomFieldDef[];
}

const DEFAULT_STAFF_TYPE_OPTIONS = [
  "Direct Support Professional",
  "Host Home Provider",
  "Executive Director",
  "Operations Director",
  "Executive Assistant",
];

const DEFAULT_DEPARTMENT_OPTIONS = [
  "Host Home",
  "Day Support",
  "Administration",
  "Clinical",
  "Transportation",
];

export const WORKER_TYPE_OPTIONS = ["W2 Employee", "1099 Contractor", "Other"];

function defaultConfig(): StaffIntakeFieldsConfig {
  return {
    staff_type: { enabled: true, options: [...DEFAULT_STAFF_TYPE_OPTIONS] },
    department: { enabled: false, options: [...DEFAULT_DEPARTMENT_OPTIONS] },
    employee_id: { enabled: false },
    worker_type: { enabled: false },
    custom_fields: [],
  };
}

export function normalizeConfig(raw: unknown): StaffIntakeFieldsConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<StaffIntakeFieldsConfig>;
  return {
    staff_type: {
      enabled: r.staff_type?.enabled ?? base.staff_type.enabled,
      options: r.staff_type?.options?.length ? r.staff_type.options : base.staff_type.options,
    },
    department: {
      enabled: r.department?.enabled ?? base.department.enabled,
      options: r.department?.options?.length ? r.department.options : base.department.options,
    },
    employee_id: { enabled: r.employee_id?.enabled ?? base.employee_id.enabled },
    worker_type: { enabled: r.worker_type?.enabled ?? base.worker_type.enabled },
    custom_fields: Array.isArray(r.custom_fields) ? r.custom_fields : [],
  };
}
