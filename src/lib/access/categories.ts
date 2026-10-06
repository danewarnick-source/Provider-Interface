// The 18 access categories. Keys are stored in access_presets.categories and
// organization_members.access_overrides, and mirrored in SQL access_categories().

export type CategoryValue = "off" | "view" | "edit";

export interface AccessCategory {
  id: CategoryId;
  label: string;
  covers: string;
  /** What the person can / can't do at each setting. Shown in the setting's dropdown. */
  explain: Record<CategoryValue, string>;
  /** On/Off only (stored as edit/off). */
  onOff?: boolean;
  /** Only Owners have it; can't be granted. */
  ownerOnly?: boolean;
}

export const CATEGORY_IDS = [
  "staff_roster",
  "staff_hiring",
  "staff_compliance",
  "clients",
  "client_medical",
  "documentation",
  "incidents",
  "hrc",
  "scheduling",
  "timesheets",
  "billing",
  "payroll",
  "financial_reports",
  "reports",
  "hosts",
  "loans",
  "agency_settings",
  "phone_app",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type CategoryMap = Partial<Record<CategoryId, CategoryValue>>;

export const CATEGORIES: AccessCategory[] = [
  {
    id: "staff_roster",
    label: "Team roster & profiles",
    covers: "The team member list and each person's profile.",
    explain: {
      off: "Can't see the team member list or open anyone's profile.",
      view: "Can see the team member list and open profiles (contact info, hire date, job title, home). Can't change anything.",
      edit: "Everything in View, plus edit names, phone, email, hire date, job title and home. Can't hire, deactivate, or change anyone's access.",
    },
  },
  {
    id: "staff_hiring",
    label: "Hire & deactivate team members",
    covers: "Bringing people on and taking them off.",
    explain: {
      off: "Can't add, invite, or deactivate anyone.",
      view: "Can see pending invites and deactivated team members. Can't add, invite, reset passwords, or deactivate.",
      edit: "Can add team members, upload a roster, send and resend invites, reset passwords, deactivate and reactivate. Can't choose anyone's access level or preset (Owners only).",
    },
  },
  {
    id: "staff_compliance",
    label: "Team member file & training",
    covers: "Team member file items, evidence, certifications, training.",
    explain: {
      off: "Can't see anyone's team member file, certifications or training.",
      view: "Can see team member file items, uploaded evidence, certification status, training progress and team compliance reports. Can't upload, approve, or assign.",
      edit: "Can upload and file documents, approve certifications and evidence, assign training, create and edit courses, and manage obligations.",
    },
  },
  {
    id: "clients",
    label: "Clients & charts",
    covers: "The client list, charts, goals, documents, intake.",
    explain: {
      off: "Can't see clients (except the clients on their own shift, if Phone app basics is On).",
      view: "Can see the client list and open charts, goals, documents and intake info. Can't change anything. Medical info is a separate setting.",
      edit: "Can add clients, edit charts, goals and documents, and run intake. Can't see medical info unless Client medical is also on.",
    },
  },
  {
    id: "client_medical",
    label: "Client medical & medications",
    covers: "Diagnoses, medical info, medication list, eMAR.",
    explain: {
      off: "Can't see diagnoses, medical info or medications.",
      view: "Can see diagnoses, medical info, the medication list and eMAR history. Can't change them.",
      edit: "Can edit medical info and the medication list and manage eMAR. (Passing meds on a shift is part of Phone app basics.)",
    },
  },
  {
    id: "documentation",
    label: "Documentation review",
    covers: "Other people's shift notes, daily logs, form submissions.",
    explain: {
      off: "Can't see other people's shift notes, daily logs or form submissions.",
      view: "Can read shift notes, daily logs and form submissions. Can't correct, send back, or approve them.",
      edit: "Can read, correct, send back and approve shift notes, daily logs and form submissions.",
    },
  },
  {
    id: "incidents",
    label: "Incidents",
    covers: "Incident reports after they're filed.",
    explain: {
      off: "Can't see incident reports. (Can still report one from the phone app if Phone app basics is On.)",
      view: "Can read incident reports. Can't update, close, or export them.",
      edit: "Can manage incidents (follow-up, status, close) and export incident reports.",
    },
  },
  {
    id: "hrc",
    label: "HRC / rights restrictions",
    covers: "Human Rights Committee reviews and rights-modification records.",
    explain: {
      off: "Can't see HRC reviews or rights-modification records.",
      view: "Can read HRC reviews and rights-modification records. Can't add, change, or record decisions.",
      edit: "Can create and update HRC reviews, record decisions, and manage rights-modification records.",
    },
  },
  {
    id: "scheduling",
    label: "Scheduling",
    covers: "The shift schedule.",
    explain: {
      off: "Can't see the schedule (except their own shifts in the phone app).",
      view: "Can see the schedule. Can't create, change, or delete shifts.",
      edit: "Can create, edit and delete shifts, set up recurring shifts, and approve swaps. HIVE still blocks shifts with no active authorization.",
    },
  },
  {
    id: "timesheets",
    label: "Timesheets & EVV",
    covers: "Other people's timesheets and EVV records.",
    explain: {
      off: "Can't see anyone else's timesheets.",
      view: "Can see timesheets and EVV records. Can't edit, approve, or export them.",
      edit: "Can edit and approve timesheets and export EVV data.",
    },
  },
  {
    id: "billing",
    label: "Billing",
    covers: "Billing, claims, authorizations (1056), service codes.",
    explain: {
      off: "Can't see billing, claims, authorizations or service codes.",
      view: "Can see billing, claims, authorizations and service codes. Can't change or submit anything.",
      edit: "Can manage billing and claims, authorizations and service codes.",
    },
  },
  {
    id: "payroll",
    label: "Payroll",
    covers: "Payroll runs and pay data.",
    explain: {
      off: "Can't see anyone's pay.",
      view: "Can see payroll runs and pay data. Can't change or run payroll.",
      edit: "Can run and change payroll.",
    },
  },
  {
    id: "financial_reports",
    label: "Financial reports",
    covers: "Gross revenue, RHS financials, employee cost reports.",
    explain: {
      off: "Can't see financial reports.",
      view: "Can see gross revenue, RHS financials and employee cost reports. Can't export them.",
      edit: "Can see and export financial reports.",
    },
  },
  {
    id: "reports",
    label: "Reports, analytics & audit trail",
    covers: "Dashboards, CSV reports, practice audit, audit trail.",
    explain: {
      off: "Can't see dashboards, reports or the audit trail.",
      view: "Can see dashboards, analytics and the audit trail. Can't export reports.",
      edit: "Can also export CSV reports and run practice audits.",
    },
  },
  {
    id: "hosts",
    label: "Hosts & referrals",
    covers: "Host Home Provider cards and referrals.",
    explain: {
      off: "Can't see host cards or referrals.",
      view: "Can see host cards and referrals. Can't change status, notes or links.",
      edit: "Can manage host cards and referrals (status, notes, links).",
    },
  },
  {
    id: "loans",
    label: "Employee loans",
    covers: "Loan agreements, e-signature, loan ledger.",
    explain: {
      off: "Can't see employee loans.",
      view: "Can see loan agreements, signatures and ledgers. Can't create, edit, send for signature, or delete.",
      edit: "Can create and edit loans, send them for e-signature, add ledger entries, and delete loans.",
    },
  },
  {
    id: "agency_settings",
    label: "Agency settings & permissions",
    covers: "Agency setup, form builder, access levels, presets, scopes, email sending.",
    ownerOnly: true,
    explain: {
      off: "Everyone except Owners. Can't be given to anyone else.",
      view: "(not available)",
      edit: "Owners only: agency setup, form builder, access levels, presets, scopes and email sending.",
    },
  },
  {
    id: "phone_app",
    label: "Phone app basics",
    covers: "The phone app for their own work.",
    onOff: true,
    explain: {
      off: "Can't use the phone app's work features.",
      view: "(On/Off only)",
      edit: "On: can clock in/out, see own timesheets, write shift notes and daily logs, submit forms, report incidents, pass meds (eMAR), and do their own training and certs. Only their own work and today's clients.",
    },
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  AccessCategory
>;

/** Values a setting's dropdown offers. */
export function categoryChoices(cat: AccessCategory): CategoryValue[] {
  if (cat.ownerOnly) return ["off"];
  return cat.onOff ? ["off", "edit"] : ["off", "view", "edit"];
}

export function valueLabel(cat: AccessCategory, v: CategoryValue): string {
  if (cat.onOff) return v === "edit" ? "On" : "Off";
  return v === "edit" ? "Edit" : v === "view" ? "View" : "Off";
}
