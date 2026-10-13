import test from "node:test";
import assert from "node:assert/strict";
import { at, ctx, has, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `x${i}`);

test("respite ratios: facility 1:6, staff home 1:3 counting the staff member's own children (§22.3(1))", () => {
  const fac = (n: number) => shift({ clientId: null, code: "RP2", place: "facility", groupClientIds: ids(n), groupStaffCount: 1 });
  assert.ok(has(run(fac(7), ctx()), "respite_facility_over_1_6", "block"));
  assert.ok(!has(run(fac(6), ctx()), "respite_facility_over_1_6"));
  const home = (n: number, kids: number) =>
    run(shift({ clientId: null, code: "RP2", place: "staff_home", groupClientIds: ids(n) }), ctx({ staff: { householdUnder14: kids } }));
  assert.ok(has(home(2, 2), "respite_staff_home_over_1_3", "block"));
  assert.ok(!has(home(2, 1), "respite_staff_home_over_1_3"));
});

test("RP4, RP5 and RPS can't be in the client's home; RPS not in a relative's or staff home (§24.4(2), §25.4(2), §26.4)", () => {
  for (const code of ["RP4", "RP5", "RPS"]) {
    assert.ok(has(run(shift({ code, place: "client_home" }), ctx({ codes: [code], client: { hasForm929: true } })), "respite_in_client_home", "block"), code);
    assert.ok(!has(run(shift({ code, place: "facility" }), ctx({ codes: [code], client: { hasForm929: true } })), "respite_in_client_home"), code);
  }
  for (const place of ["relative_home", "staff_home"] as const) {
    assert.ok(has(run(shift({ code: "RPS", place }), ctx({ codes: ["RPS"] })), "rps_relative_or_staff_home"), place);
  }
  assert.ok(!has(run(shift({ code: "RPS", place: "facility" }), ctx({ codes: ["RPS"] })), "rps_relative_or_staff_home"));
});

test("RP3 and RP5 need Form 929 on file (§23.3(1), §25.3)", () => {
  for (const code of ["RP3", "RP5"]) {
    assert.ok(has(run(shift({ code }), ctx({ codes: [code] })), "respite_no_form_929", "block"), code);
    assert.ok(!has(run(shift({ code }), ctx({ codes: [code], client: { hasForm929: true } })), "respite_no_form_929"), code);
  }
  assert.ok(!has(run(shift({ code: "RP2" }), ctx({ codes: ["RP2"] })), "respite_no_form_929"));
});

test("BC1-BC3: no direct support or transport (§3.5)", () => {
  for (const code of ["BC1", "BC2", "BC3"]) {
    const c = ctx({ codes: [code] });
    assert.ok(has(run(shift({ code, directSupport: true }), c), "bc_direct_support", "block"), code);
    assert.ok(has(run(shift({ code, transport: true }), c), "bc_transport", "block"), code);
    assert.ok(!has(run(shift({ code }), c), "bc_direct_support"), code);
  }
});

test("host homes: HHS client 18+, PPS client under 22 (§11.2(1), §20.1)", () => {
  assert.ok(has(run(shift({ code: "HHS" }), ctx({ codes: ["HHS"], client: { age: 17 } })), "hhs_under_18", "block"));
  assert.ok(!has(run(shift({ code: "HHS" }), ctx({ codes: ["HHS"], client: { age: 18 } })), "hhs_under_18"));
  assert.ok(has(run(shift({ code: "PPS" }), ctx({ codes: ["PPS"], client: { age: 22 } })), "pps_22_or_older", "block"));
  assert.ok(!has(run(shift({ code: "PPS" }), ctx({ codes: ["PPS"], client: { age: 21 } })), "pps_22_or_older"));
});

test("host homes: one client per home unless an exception is on file (§11.3(7), §20.3(7))", () => {
  for (const code of ["HHS", "PPS"]) {
    const c = (o = {}) => ctx({ codes: [code], client: { age: 20, homeClientCount: 2, ...o } });
    assert.ok(has(run(shift({ code }), c()), "host_home_one_client", "block"), code);
    assert.ok(!has(run(shift({ code }), c({ homeException: true })), "host_home_one_client"), code);
    assert.ok(!has(run(shift({ code }), c({ homeClientCount: 1 })), "host_home_one_client"), code);
  }
});

test("no HHS and PPS clients in the same home (§11.4(4))", () => {
  const c = ctx({ codes: ["HHS"], client: { age: 20, homeHasOtherCodeClients: "PPS" } });
  assert.ok(has(run(shift({ code: "HHS" }), c), "hhs_pps_same_home", "block"));
  assert.ok(!has(run(shift({ code: "HHS" }), ctx({ codes: ["HHS"], client: { age: 20, homeHasOtherCodeClients: "HHS" } })), "hhs_pps_same_home"));
});

test("HHS respite: day 22 of a Plan Year blocks, day 21 does not; 15 days running blocks (§11.3(7)(D))", () => {
  const respite = (o = {}) => shift({ code: "HHS", respite: "own_home", ...o });
  const c = (used: number) => ctx({ codes: ["HHS"], client: { age: 20, respiteDaysOwnHome: used } });
  assert.ok(has(run(respite(), c(21)), "host_respite_over_21", "block")); // this is day 22
  assert.ok(!has(run(respite(), c(20)), "host_respite_over_21")); // day 21
  assert.ok(has(run(respite({ respiteConsecutiveDay: 15 }), c(5)), "host_respite_over_14_consecutive"));
  assert.ok(!has(run(respite({ respiteConsecutiveDay: 14 }), c(5)), "host_respite_over_14_consecutive"));
});

test("respite in a different home: more than 20 days a Plan Year blocks (§11.4(9), §20.4(9))", () => {
  const other = (code: string, used: number) =>
    run(shift({ code, respite: "other_home" }), ctx({ codes: [code], client: { age: 20, respiteDaysOtherHome: used } }));
  assert.ok(has(other("HHS", 20), "host_respite_other_home_over_20", "block"));
  assert.ok(!has(other("HHS", 19), "host_respite_other_home_over_20"));
  assert.ok(has(other("PPS", 20), "host_respite_other_home_over_20"));
});

test("RHS isn't billable when the client lives with an immediate relative or guardian (§21.4(1))", () => {
  assert.ok(has(run(shift({ code: "RHS" }), ctx({ codes: ["RHS"], client: { livesWithRelativeOrGuardian: true } })), "rhs_lives_with_relative", "block"));
  assert.ok(!has(run(shift({ code: "RHS" }), ctx({ codes: ["RHS"] })), "rhs_lives_with_relative"));
});

test("SED work groups are 2 to 8 people (§28.2(1))", () => {
  const sed = (n: number) => shift({ clientId: null, code: "SED", groupClientIds: ids(n), groupStaffCount: 2 });
  assert.ok(has(run(sed(1)), "sed_group_size", "block"));
  assert.ok(has(run(sed(9)), "sed_group_size", "block"));
  for (const n of [2, 8]) assert.ok(!has(run(sed(n)), "sed_group_size"), String(n));
});

test("SJD: not under 14, at most 80 hours (120 with approval) (§33.4(2),(4))", () => {
  const sjd = shift({ code: "SJD", startsAt: at(9), endsAt: at(11) });
  assert.ok(has(run(sjd, ctx({ codes: ["SJD"], client: { age: 13 } })), "sjd_under_14", "block"));
  assert.ok(!has(run(sjd, ctx({ codes: ["SJD"], client: { age: 14 } })), "sjd_under_14"));
  assert.ok(has(run(sjd, ctx({ codes: ["SJD"], client: { sjdHoursUsed: 79 } })), "sjd_over_hours", "block"));
  assert.ok(!has(run(sjd, ctx({ codes: ["SJD"], client: { sjdHoursUsed: 78 } })), "sjd_over_hours"));
  assert.ok(!has(run(sjd, ctx({ codes: ["SJD"], client: { sjdHoursUsed: 100, sjdExtendedApproval: true } })), "sjd_over_hours"));
});

test("SEI by telehealth alone warns, with in-person that day it doesn't (§30.2(1)(E))", () => {
  const tele = shift({ code: "SEI", telehealth: true });
  assert.ok(has(run(tele, ctx({ codes: ["SEI"] })), "sei_telehealth_alone", "warn"));
  const inPerson = shift({ id: "o", staffId: "s2", code: "SEI", startsAt: at(13), endsAt: at(14) });
  assert.ok(!has(run(tele, ctx({ codes: ["SEI"], shifts: [inPerson] })), "sei_telehealth_alone"));
  assert.ok(!has(run(shift({ code: "SEI" }), ctx({ codes: ["SEI"] })), "sei_telehealth_alone"));
});

test("EPR: under 20% community time warns, 24 straight months blocks (§9.3(1), §9.4(2))", () => {
  const epr = shift({ code: "EPR" });
  assert.ok(has(run(epr, ctx({ codes: ["EPR"], client: { eprCommunityShare: 0.1 } })), "epr_under_20_community", "warn"));
  assert.ok(!has(run(epr, ctx({ codes: ["EPR"], client: { eprCommunityShare: 0.2 } })), "epr_under_20_community"));
  assert.ok(has(run(epr, ctx({ codes: ["EPR"], client: { eprMonthsServed: 24 } })), "epr_over_24_months", "block"));
  assert.ok(!has(run(epr, ctx({ codes: ["EPR"], client: { eprMonthsServed: 24, eprExtensionApproved: true } })), "epr_over_24_months"));
  assert.ok(!has(run(epr, ctx({ codes: ["EPR"], client: { eprMonthsServed: 23 } })), "epr_over_24_months"));
});

test("DSP extended is 10 hours at most (§7.6(b))", () => {
  const dsp = (h: number) => shift({ code: "DSP", startsAt: at(6), endsAt: at(6 + h) });
  assert.ok(has(run(dsp(11), ctx({ codes: ["DSP"] })), "dsp_over_10h", "block"));
  assert.ok(!has(run(dsp(10), ctx({ codes: ["DSP"] })), "dsp_over_10h"));
});

test("DSI mostly site-based in a Sun-Sat week warns (§8.4(5))", () => {
  const site = shift({ code: "DSI", place: "site", startsAt: at(9), endsAt: at(14) });
  const comm = shift({ id: "o", staffId: "s2", code: "DSI", place: "community", startsAt: at(15), endsAt: at(17) });
  assert.ok(has(run(site, ctx({ codes: ["DSI"], shifts: [comm] })), "dsi_mostly_site_based", "warn"));
  const more = shift({ id: "o", staffId: "s2", code: "DSI", place: "community", startsAt: at(15), endsAt: at(21) });
  assert.ok(!has(run(site, ctx({ codes: ["DSI"], shifts: [more] })), "dsi_mostly_site_based"));
});

test("DSG can't be solely in the client's home or a staff home (§7.4)", () => {
  assert.ok(has(run(shift({ code: "DSG", place: "client_home" }), ctx({ codes: ["DSG"] })), "dsg_in_home", "block"));
  assert.ok(has(run(shift({ code: "DSG", place: "staff_home" }), ctx({ codes: ["DSG"] })), "dsg_in_home"));
  assert.ok(!has(run(shift({ code: "DSG", place: "site" }), ctx({ codes: ["DSG"] })), "dsg_in_home"));
});

test("TFB with RHS, HHS, PPS or SLH needs the Director's written approval (§36.3(1))", () => {
  for (const code of ["RHS", "HHS", "PPS", "SLH"]) {
    const c = (o = {}) => ctx({ codes: ["TFB"], client: { otherCodes: [code], ...o } });
    assert.ok(has(run(shift({ code: "TFB" }), c()), "tfb_with_residential", "block"), code);
    assert.ok(!has(run(shift({ code: "TFB" }), c({ tfbDirectorApproval: true })), "tfb_with_residential"), code);
  }
  assert.ok(!has(run(shift({ code: "TFB" }), ctx({ codes: ["TFB"] })), "tfb_with_residential"));
});

test("ELS by HHS/PPS staff needs the 4 documented conditions on file (§10.4(4))", () => {
  const els = shift({ code: "ELS" });
  assert.ok(has(run(els, ctx({ codes: ["ELS"], staff: { isHostStaff: true } })), "els_host_staff_conditions", "block"));
  assert.ok(!has(run(els, ctx({ codes: ["ELS"], staff: { isHostStaff: true }, client: { elsHostConditionsOnFile: true } })), "els_host_staff_conditions"));
  assert.ok(!has(run(els, ctx({ codes: ["ELS"] })), "els_host_staff_conditions"));
});
