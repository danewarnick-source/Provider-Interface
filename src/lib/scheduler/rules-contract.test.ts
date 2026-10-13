import test from "node:test";
import assert from "node:assert/strict";
import { DAY, addDays, at, ctx, has, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);

test("hospital: admission day blocked, days between blocked, discharge day allowed (§2.1(5)(A))", () => {
  const c = (start: string, end: string | null) => ctx({ client: { absences: [{ kind: "hospital", startDate: start, endDate: end }] } });
  assert.ok(has(run(shift(), c(DAY, "2026-10-16")), "client_in_hospital", "block"));
  assert.ok(has(run(shift(), c("2026-10-12", "2026-10-16")), "client_in_hospital"));
  assert.ok(!has(run(shift(), c("2026-10-10", DAY)), "client_in_hospital")); // discharge day
  assert.ok(!has(run(shift(), c("2026-10-20", null)), "client_in_hospital"));
  assert.ok(has(run(shift(), c("2026-10-01", null)), "client_in_hospital")); // still admitted
});

test("jail: every day including release day is blocked (§2.1(5)(K))", () => {
  const c = (start: string, end: string | null) => ctx({ client: { absences: [{ kind: "jail", startDate: start, endDate: end }] } });
  assert.ok(has(run(shift(), c("2026-10-10", DAY)), "client_in_jail", "block"));
  assert.ok(!has(run(shift(), c("2026-10-01", "2026-10-13")), "client_in_jail"));
});

test("custody: COM is barred for a DCFS or DJJYS client", () => {
  const com = shift({ code: "COM" });
  assert.ok(has(run(com, ctx({ codes: ["COM"], client: { custody: "dcfs" } })), "custody_barred_code", "block"));
  assert.ok(has(run(com, ctx({ codes: ["COM"], client: { custody: "djjys" } })), "custody_barred_code", "block"));
  assert.ok(!has(run(com, ctx({ codes: ["COM"], client: { custody: "none" } })), "custody_barred_code"));
  assert.ok(has(run(shift({ code: "HSQ" }), ctx({ codes: ["HSQ"], client: { custody: "djjys" } })), "custody_barred_code"));
});

test("custody: SL, CMP/CMS, RP2-RP5 and TFB are barred for DCFS only", () => {
  for (const code of ["SLH", "SLN", "CMP", "CMS", "RP2", "RP3", "RP4", "RP5", "TFB"]) {
    const c = (custody: "dcfs" | "djjys") => ctx({ codes: [code], client: { custody } });
    assert.ok(has(run(shift({ code }), c("dcfs")), "custody_barred_code", "block"), code);
    assert.ok(!has(run(shift({ code }), c("djjys")), "custody_barred_code"), code);
  }
});

test("asleep time on SLH/SLN/CMP/CMS warns without an awake slot (§31.4(4), §32.4(6))", () => {
  for (const code of ["SLH", "SLN", "CMP", "CMS"]) {
    const night = shift({ code, startsAt: at(22), endsAt: at(6, 0, addDays(DAY, 1)) });
    const c = ctx({ codes: [code] });
    assert.ok(has(run(night, c), "asleep_not_billable", "warn"), code);
    assert.ok(!has(run({ ...night, awakeConfirmed: true }, c), "asleep_not_billable"), code);
  }
  assert.ok(!has(run(shift({ startsAt: at(9), endsAt: at(15) })), "asleep_not_billable"));
  assert.ok(!has(run(shift({ code: "COM", startsAt: at(22), endsAt: at(6, 0, addDays(DAY, 1)) }), ctx({ codes: ["COM"] })), "asleep_not_billable"));
});

test("SL is limited to 4 hours when overnight respite is in the same 24 hours (§31.4(3), §32.4(3))", () => {
  const c = ctx({ client: { overnightRespiteDays: [DAY] } });
  assert.ok(has(run(shift({ startsAt: at(8), endsAt: at(13) }), c), "sl_with_overnight_respite", "block"));
  assert.ok(!has(run(shift({ startsAt: at(8), endsAt: at(12) }), c), "sl_with_overnight_respite"));
  assert.ok(!has(run(shift({ startsAt: at(8), endsAt: at(13) }), ctx()), "sl_with_overnight_respite"));
});

test("RP2-RP5 daily rate can't be billed on a day with more than 4 hours of SL", () => {
  const sl = shift({ id: "sl", staffId: "s2", startsAt: at(14), endsAt: at(19) });
  for (const code of ["RP2", "RP3"]) {
    const six = shift({ code, startsAt: at(6), endsAt: at(12, 0) });
    assert.ok(has(run(six, ctx({ codes: [code], shifts: [sl] })), "respite_daily_over_4h_sl", "block"), code);
    const two = shift({ code, startsAt: at(6), endsAt: at(8) });
    assert.ok(!has(run(two, ctx({ codes: [code], shifts: [sl] })), "respite_daily_over_4h_sl"), code);
  }
  const rp4 = shift({ code: "RP4", startsAt: at(6), endsAt: at(8) });
  assert.ok(has(run(rp4, ctx({ codes: ["RP4"], shifts: [sl] })), "respite_daily_over_4h_sl"));
  const shortSl = shift({ id: "sl", staffId: "s2", startsAt: at(14), endsAt: at(18) });
  assert.ok(!has(run(rp4, ctx({ codes: ["RP4"], shifts: [shortSl] })), "respite_daily_over_4h_sl"));
});

test("SLN, CMP and CMS follow the staff relationship (§32.6); wrong one blocks with the right code", () => {
  const rel = (relation: "parent" | "step_parent" | "guardian" | "spouse" | "other") => ({ relationTo: { c1: relation } });
  const check = (code: string, relation: Parameters<typeof rel>[0]) =>
    run(shift({ code }), ctx({ codes: ["SLN", "CMP", "CMS"], staff: rel(relation) }));
  for (const r of ["parent", "step_parent", "guardian"] as const) {
    assert.ok(has(check("SLN", r), "wrong_natural_supports_code", "block"), r);
    assert.equal(check("SLN", r).find((f) => f.rule === "wrong_natural_supports_code")?.fix?.code, "CMP");
    assert.ok(!has(check("CMP", r), "wrong_natural_supports_code"), r);
  }
  assert.ok(has(check("CMP", "spouse"), "wrong_natural_supports_code"));
  assert.equal(check("SLN", "spouse").find((f) => f.rule === "wrong_natural_supports_code")?.fix?.code, "CMS");
  assert.ok(!has(check("CMS", "spouse"), "wrong_natural_supports_code"));
  assert.ok(has(check("CMS", "other"), "wrong_natural_supports_code"));
  assert.ok(!has(check("SLN", "other"), "wrong_natural_supports_code"));
});

test("MTP never with DSI (§8.4(4))", () => {
  const dsi = shift({ id: "d", staffId: "s2", code: "DSI", startsAt: at(9), endsAt: at(11) });
  const mtp = shift({ code: "MTP", startsAt: at(8), endsAt: at(9) });
  assert.ok(has(run(mtp, ctx({ codes: ["MTP", "DSI"], shifts: [dsi] })), "mtp_with_dsi", "block"));
});

test("MTP needs DSG, DSP, EPR or SED the same day (§13.1, §9.2(7), §28.2(5))", () => {
  const mtp = shift({ code: "MTP", startsAt: at(8), endsAt: at(9) });
  assert.ok(has(run(mtp, ctx({ codes: ["MTP"] })), "mtp_needs_day_support", "block"));
  for (const code of ["DSG", "DSP", "EPR", "SED"]) {
    const day = shift({ id: "d", staffId: "s2", code, startsAt: at(9), endsAt: at(15) });
    assert.ok(!has(run(mtp, ctx({ codes: ["MTP", code], shifts: [day] })), "mtp_needs_day_support"), code);
  }
});

test("MTP days can't pass the day-support days billed in the month (§13.4(3))", () => {
  const mtp = shift({ code: "MTP", startsAt: at(8), endsAt: at(9) });
  const dsg = shift({ id: "d", staffId: "s2", code: "DSG", startsAt: at(9), endsAt: at(15) });
  const c = (mtpDays: number) => ctx({ codes: ["MTP", "DSG"], shifts: [dsg], client: { mtpDaysBilled: mtpDays, dayServiceDaysBilled: 5 } });
  assert.ok(has(run(mtp, c(5)), "mtp_days_over_day_support_days", "block"));
  assert.ok(!has(run(mtp, c(4)), "mtp_days_over_day_support_days"));
});

test("PM1 and PM2 aren't billable when the client gets PN1 or PN2 (§16.3, §17.3)", () => {
  for (const [pm, pn] of [["PM1", "PN1"], ["PM2", "PN2"], ["PM1", "PN2"]]) {
    const other = shift({ id: "n", staffId: "s2", code: pn, startsAt: at(13), endsAt: at(14) });
    const c = ctx({ codes: [pm, pn], shifts: [other] });
    assert.ok(has(run(shift({ code: pm }), c), "pm_with_pn", "block"), `${pm}+${pn}`);
    assert.ok(!has(run(shift({ code: pm }), ctx({ codes: [pm] })), "pm_with_pn"), pm);
  }
  const viaFlag = ctx({ codes: ["PM1"], client: { otherCodes: ["PN1"] } });
  assert.ok(has(run(shift({ code: "PM1" }), viaFlag), "pm_with_pn"));
});

test("PN1 only when the agency provides the residential service, with PN2 oversight (§18.4)", () => {
  const pn1 = shift({ code: "PN1" });
  assert.ok(has(run(pn1, ctx({ codes: ["PN1"], client: { agencyIsResidentialProvider: false, hasPn2Oversight: true } })), "pn1_not_residential_provider", "block"));
  assert.ok(has(run(pn1, ctx({ codes: ["PN1"], client: { agencyIsResidentialProvider: true, hasPn2Oversight: false } })), "pn1_no_pn2_oversight", "block"));
  const good = ctx({ codes: ["PN1"], client: { agencyIsResidentialProvider: true, hasPn2Oversight: true } });
  assert.ok(!has(run(pn1, good), "pn1_not_residential_provider") && !has(run(pn1, good), "pn1_no_pn2_oversight"));
});

test("PN2: not daily and session the same day; daily needs a visit; over 3 days a week warns (§19.4, §19.7)", () => {
  const daily = shift({ code: "PN2", pn2Kind: "daily", inPerson: true, startsAt: at(9), endsAt: at(10) });
  const session = shift({ id: "n", staffId: "s2", code: "PN2", pn2Kind: "session", startsAt: at(13), endsAt: at(14) });
  assert.ok(has(run(daily, ctx({ codes: ["PN2"], shifts: [session] })), "pn2_daily_and_session", "block"));
  assert.ok(!has(run(daily, ctx({ codes: ["PN2"] })), "pn2_daily_and_session"));
  assert.ok(has(run({ ...daily, inPerson: false }, ctx({ codes: ["PN2"] })), "pn2_daily_needs_visit", "block"));
  assert.ok(!has(run(daily, ctx({ codes: ["PN2"] })), "pn2_daily_needs_visit"));
  const days = ["2026-10-12", "2026-10-13", "2026-10-15"].map((d, i) =>
    shift({ id: `p${i}`, staffId: "s2", code: "PN2", startsAt: at(9, 0, d), endsAt: at(10, 0, d) }));
  assert.ok(has(run(daily, ctx({ codes: ["PN2"], shifts: days })), "pn2_over_3_days", "warn"));
  assert.ok(!has(run({ ...daily, reason: "Wound care can't be delegated" }, ctx({ codes: ["PN2"], shifts: days })), "pn2_over_3_days"));
  assert.ok(!has(run(daily, ctx({ codes: ["PN2"], shifts: days.slice(0, 2) })), "pn2_over_3_days"));
});
