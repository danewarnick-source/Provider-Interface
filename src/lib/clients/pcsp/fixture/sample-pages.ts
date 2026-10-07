// A made-up USTEPS PCSP as positioned text lines (what layout.ts produces
// from a PDF). Every name, number and address here is invented — no PHI.
// Used by parser.test.ts (exact output) and the e2e mock for the review.
// Covers: 2 goals, a support that runs onto the next page, several supports
// per goal, another agency's provider, a non-goal support paid to the agency,
// purchased services with the code and name split by one space or a dash, a
// service continued across a page break, one missing its code, the standard
// "obsolete" lines plus one naming a code, and a page printed on top of itself.

import type { LayoutPage } from "../layout.ts";

export const SAMPLE_AGENCY = { agencyName: "Example Supports, LLC", agencyCodes: ["DSI", "SEI", "HHS"] };

/** Build a line with each text starting at a character column. */
function at(...parts: [number, string][]): string {
  let line = "";
  for (const [col, text] of parts) {
    line = line.length < col ? line + " ".repeat(col - line.length) : line + " ";
    line += text;
  }
  return line;
}
const f = (label: string, value?: string, labelCol = 2) => (value === undefined ? at([labelCol, label]) : at([labelCol, label], [24, value]));

const HEADER = "Person Centered Support Plan (PCSP) Report";
const footer = (activated = "Plan Activated: Aug 20, 2026") => [
  "Plan Status: Active",
  activated,
  "Report Printed: 08/21/2026 10:00 AM",
];

function page(index: number, lines: string[]): LayoutPage {
  return { index, lines: lines.map((text, i) => ({ y: 780 - i * 12, text })) };
}

export const SAMPLE_PCSP_PAGES: LayoutPage[] = [
  page(1, [
    HEADER,
    at([20, "Pat Q. Example"]),
    at([20, "09/01/2026 - 08/31/2027"]),
    "Personal Information",
    f("Legal Name:", "Pat Q. Example"),
    f("PID:", "0000000"),
    f("Date of Birth:", "01/02/1990"),
    f("Residential Address:", "100 Sample Street"),
    at([24, "Exampleville, UT 84000"]),
    f("Phone:", "555-0100"),
    f("Support Coordinator:"),
    f("Name:", "Casey Sample casey@example.test"),
    f("Phone:", "555-0101"),
    f("Company:", "Sample Coordination Co"),
    "Plan Meeting Minutes",
    f("Meeting Date:", "08/15/2026"),
    ...footer(),
  ]),
  page(2, [
    HEADER,
    "Annual Review for Goals",
    f("Goal:", "Pat will cook a simple meal each week."),
    f("Goal Status:", "Partially met"),
    at([2, "Ongoing Goal for New Plan?   Y"]),
    f("Goal:", "Pat will ride the bus to the library."),
    f("Goal Status:", "Met"),
    at([2, "Ongoing Goal for New Plan?   N"]),
    "Action Plan",
    "Healthy Living",
    at([0, "Label"], [30, "Note"], [70, "Category"], [85, "From"]),
    at([0, "Likes"], [30, "Pat enjoys gardening and music."], [70, "Important"], [85, "Pat"]),
    at([0, "outdoors"], [30, "Morning walks help."]),
    "Safety & Security",
    at([0, "Does not like"], [30, "Loud crowded rooms."], [70, "Important"], [85, "Guardian"]),
    ...footer(),
  ]),
  page(3, [
    HEADER,
    "Goals and Supports",
    f("Goal:", "Pat will cook a simple meal each week."),
    f("Goal Domain:", "Healthy Living"),
    f("Current Status:", "Pat makes sandwiches with help."),
    f("Strengths:", "Pat follows picture recipes."),
    f("Barriers:", "Needs help with the stove."),
    at([2, "Success Criteria"]),
    at([2, "What does success look like to Pat?"]),
    at([2, "Pat cooks pasta on Sundays."]),
    at([2, "What does success look like to the team?"]),
    at([2, "Pat cooks with only verbal prompts."]),
    at([2, "Support Item"]),
    f("Support:", "Staff will coach Pat through each recipe step."),
    f("Support Details:", "Use the picture recipe binder."),
    f("Support Dates:", "Start Date: 09/01/2026   End Date: 08/31/2027"),
    f("Paid Provider:", "DSI  Example Supports, LLC"),
    f("Natural Support:", "Parent shops for groceries."),
    at([2, "Addressed Health and Safety Needs"]),
    at([2, "Kitchen safety"], [45, "Staff stay within reach at the stove."]),
    at([2, "Burns"], [45, "Check that burners are off."]),
    at([2, "Support Item"]),
    f("Support:", "Behavior consultant will review the kitchen"),
    at([24, "plan with staff."]),
    ...footer(),
  ]),
  page(4, [
    HEADER,
    "Goals and Supports",
    f("Goal:", "Pat will cook a simple meal each week."),
    f("Support Dates:", "Start Date: 08/15/2026   End Date: 08/31/2027"),
    f("Paid Provider:", "BC2  Sample Behavior Group Inc"),
    at([2, "Support Item"]),
    f("Support:", "Staff will help Pat clean up after cooking."),
    f("Paid Provider:", "DSI  Example Supports LLC"),
    f("Goal:", "Pat will work at a job in the community."),
    f("Goal Domain:", "Daily Life Employment"),
    at([2, "Support Item"]),
    f("Support:", "Job coach will support Pat at work."),
    f("Support Dates:", "Start Date: 09/01/2026   End Date: 08/31/2027"),
    f("Paid Provider:", "SEI  Example Supports LLC"),
    ...footer(),
  ]),
  page(5, [
    HEADER,
    "Goals and Supports",
    f("Goal:", "Pat will work at a job in the community."),
    at([2, "Support Item"]),
    f("Support:", "Sibling gives Pat rides to work."),
    f("Natural Support:", "Sibling"),
    "Goals and Supports",
    f("Goal:", "Pat will work at a jobPat will work at a"),
    f("Support:", "Sibling gives Pat ridesSibling gives"),
    ...footer("Plan Activated: Aug 20, 2026 Support: Sibling gives Pat"),
  ]),
  page(6, [
    HEADER,
    "Non Goal Supports",
    f("Support:", "Behavior support plan for Pat at home."),
    f("Support Details:", "Sample Behavior Group writes the plan."),
    f("Support Dates:", "Start Date: 09/01/2026   End Date: 08/31/2027"),
    f("Support:", "Host home helps Pat with daily living."),
    f("Paid Provider:", "HHS  Example Supports, LLC"),
    f("Support Dates:", "Start Date: 09/01/2026   End Date: 08/31/2027"),
    f("Support:", "Annual dental visit."),
    "DSPD Purchased Services",
    at([2, "DSI   Day Supports Individual"]),
    f("Type:", "15 Minutes", 4),
    f("Amount:", "2000 Units", 4),
    f("Duration:", "09/01/2026 - 08/31/2027", 4),
    at([2, "HHS Host Home Support"]),
    f("Type:", "Daily", 4),
    f("Amount:", "365 Units", 4),
    f("Duration:", "09/01/2026 - 08/31/2027", 4),
    at([4, "* Services marked with an asterisk are now obsolete."]),
    at([4, "Code RP4 is obsolete"]),
    at([2, "SLN - Supported Living Natural"]),
    f("Type:", "15 Minutes", 4),
    f("Amount:", "400 Units", 4),
    f("Duration:", "09/01/2026 - 08/31/2027", 4),
    at([2, "SEI   Supported Employment Individual"]),
    f("Type:", "15 Minutes", 4),
    ...footer(),
  ]),
  page(7, [
    HEADER,
    "DSPD Purchased Services",
    f("Type:", "15 Minutes", 4),
    f("Amount:", "1040 Units", 4),
    f("Duration:", "09/01/2026 - 08/31/2027", 4),
    f("Type:", "Hourly", 4),
    f("Amount:", "50 Units", 4),
    f("Duration:", "09/01/2026 - 08/31/2027", 4),
    "Plan Budget",
    at([2, "* Lines for obsolete services are shown for reference."]),
    at([2, "Example"]),
    at([2, "DSI  W  09/01/2026  08/31/2027  ELIG  $8.50  200  2000  $17,000.00"]),
    at([2, "Supports, LLC"]),
    at([2, "Example Supports,"]),
    at([2, "HHS  D  09/01/2026  08/31/2027  ELIG  $120.00  31  365  $43,800.00"]),
    at([2, "LLC"]),
    at([2, "Example"]),
    at([2, "SEI  W  09/01/2026  08/31/2027  ELIG  $9.25  100  1040  $9,620.00"]),
    at([2, "Supports LLC"]),
    at([2, "Sample Behavior"]),
    at([2, "BC2  W  09/01/2026  08/31/2027  ELIG  $20.00  10  96  $1,920.00"]),
    at([2, "Group Inc"]),
    "List of Identified Risks",
    f("Identified Risk:", "Choking on large bites of food."),
    f("Response:", "Cut food into small pieces."),
    f("Response Time:", "Immediate  Staff watch"),
    f("Notes:", "during all meals."),
    ...footer(),
  ]),
];
