// Validates the reviewed PCSP the browser sends to confirmPcsp. Limits keep
// a bad request from writing huge rows; the shape matches ReviewedPcsp.

import { z } from "zod";
import type { ReviewedPcsp } from "./review.ts";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const text = (max = 4000) => z.string().max(max);
const code = z.string().max(8);

const support = z.object({
  support: text(), details: text(), start: ymd, end: ymd,
  ourCodes: z.array(code).max(30),
  providers: z.array(z.object({ code, provider: text(300), ours: z.boolean() })).max(30),
  healthNeeds: z.array(z.object({ category: text(300), description: text() })).max(50),
});

export const reviewedPcspSchema = z.object({
  person: z.object({
    pid: text(50), dob: ymd, phone: text(50), address: text(255),
    supportCoordinator: z.object({
      include: z.boolean(), name: text(200), phone: text(50), email: text(200), company: text(200),
    }),
  }),
  plan: z.object({ start: ymd, end: ymd, activatedOn: ymd, meetingDate: ymd }),
  goals: z.array(z.object({
    include: z.boolean(),
    goal: text(), domain: text(300), currentStatus: text(), strengths: text(), barriers: text(),
    successPerson: text(), successTeam: text(), page: z.number().int().min(0).max(10_000),
    carry: z.object({
      kind: z.enum(["carried", "new"]),
      fromGoalId: z.string().uuid().nullable(),
      fromGoalText: text().nullable(),
    }),
    supports: z.array(support).max(40),
  })).max(60),
  otherNeeds: z.array(support.extend({ include: z.boolean() })).max(40),
  budget: z.array(z.object({
    include: z.boolean(), code, unitType: z.enum(["Q", "day", "hourly"]), start: ymd, end: ymd,
    rate: z.number().min(0).max(100_000), maxMonthlyUnits: z.number().int().min(0).max(1_000_000).nullable(),
    annualUnits: z.number().int().min(0).max(10_000_000),
  })).max(40),
  otherProviders: z.array(z.object({ include: z.boolean(), code, provider: text(300), note: text() })).max(40),
}) satisfies z.ZodType<ReviewedPcsp>;
