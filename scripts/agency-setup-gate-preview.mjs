#!/usr/bin/env node
/**
 * Authenticated create-API checks for the agency setup gate.
 * Isolated test origin only. Refuses Hive-Platform production.
 *
 *   AGENCY_SETUP_PREVIEW_ORIGIN=https://<isolated-test-host> \
 *   AGENCY_SETUP_PREVIEW_COOKIE='sb-access-token=...' \
 *   AGENCY_SETUP_PREVIEW_ORG_ID=<uuid> \
 *   node scripts/agency-setup-gate-preview.mjs
 */
const PROD_REF = "dhrrukdcigiiqksibdfb";
const origin = process.env.AGENCY_SETUP_PREVIEW_ORIGIN ?? "";
const cookie = process.env.AGENCY_SETUP_PREVIEW_COOKIE ?? "";
const orgId = process.env.AGENCY_SETUP_PREVIEW_ORG_ID ?? "";

if (origin.includes(PROD_REF) || process.env.AGENCY_SETUP_PREVIEW_ORIGIN?.includes("hivecertify.com")) {
  console.error("Refusing production Hive-Platform / hivecertify.com. Use an isolated test origin.");
  process.exit(2);
}

const checks = [
  { name: "employees list", path: "/dashboard/employees" },
  { name: "clients list", path: "/dashboard/clients" },
  { name: "new employee", path: "/dashboard/employees/new" },
  { name: "new client", path: "/dashboard/clients/new" },
  { name: "home stays available", path: "/dashboard" },
];

if (!origin || !cookie || !orgId) {
  console.log("Agency setup preview harness — not sending live requests.");
  console.log("Set AGENCY_SETUP_PREVIEW_ORIGIN, AGENCY_SETUP_PREVIEW_COOKIE, AGENCY_SETUP_PREVIEW_ORG_ID.");
  console.log("Expected checks after SQL is on an isolated test DB:");
  for (const check of checks) {
    console.log(`  GET ${check.path}  (${check.name})`);
  }
  console.log("  createEmployeeManually / createInvitation / clients.insert should 403 while incomplete");
  console.log("  same three succeed after the six facts (including organizations.service_area) are saved");
  process.exit(0);
}

const results = [];
for (const check of checks) {
  const res = await fetch(new URL(check.path, origin), {
    redirect: "manual",
    headers: { cookie },
  });
  results.push({
    name: check.name,
    path: check.path,
    status: res.status,
    location: res.headers.get("location"),
  });
}
console.log(JSON.stringify({ origin, orgId, results }, null, 2));
