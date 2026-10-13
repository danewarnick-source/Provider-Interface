// The Health tab's lists (allergies, diagnoses, chronic conditions, diet,
// swallowing alerts, mobility): one clients column each, the common choices
// the "Add" dropdown offers, and the add / edit / remove rules. Every reader
// (Health tab, setup, face sheet) reads the same columns. Pure, importable
// by node --test.

export type HealthListKey =
  | "allergies"
  | "diagnoses"
  | "chronic_conditions"
  | "diets"
  | "swallowing_alerts"
  | "mobility";

export type HealthListDef = {
  /** The clients column (text[]). */
  key: HealthListKey;
  label: string;
  /** Shown when the list is empty. */
  empty: string;
  /** Common choices for the Add dropdown. */
  options: readonly string[];
};

/** The dropdown value that opens a text box instead of picking a choice. */
export const OTHER_OPTION = "__other__";
export const OTHER_LABEL = "Other (type it)";

export const HEALTH_LISTS: Record<HealthListKey, HealthListDef> = {
  allergies: {
    key: "allergies",
    label: "Allergies",
    empty: "No known allergies on file",
    options: [
      "Penicillin",
      "Sulfa drugs",
      "Aspirin",
      "Ibuprofen (NSAIDs)",
      "Codeine",
      "Latex",
      "Peanuts",
      "Tree nuts",
      "Shellfish",
      "Fish",
      "Eggs",
      "Milk (dairy)",
      "Wheat (gluten)",
      "Soy",
      "Bee stings",
      "Pollen (seasonal)",
      "Pet dander",
      "Adhesive tape",
    ],
  },
  diagnoses: {
    key: "diagnoses",
    label: "Diagnoses",
    empty: "No diagnoses on file",
    options: [
      "Intellectual disability",
      "Autism spectrum disorder",
      "Down syndrome",
      "Cerebral palsy",
      "Epilepsy (seizure disorder)",
      "Fragile X syndrome",
      "Prader-Willi syndrome",
      "Acquired brain injury",
      "Fetal alcohol spectrum disorder",
      "ADHD",
      "Anxiety disorder",
      "Depression",
      "Bipolar disorder",
      "Schizophrenia",
      "Obsessive-compulsive disorder",
      "PTSD",
    ],
  },
  chronic_conditions: {
    key: "chronic_conditions",
    label: "Chronic conditions",
    empty: "None on file",
    options: [
      "Diabetes (type 1)",
      "Diabetes (type 2)",
      "High blood pressure",
      "Asthma",
      "COPD",
      "Heart disease",
      "High cholesterol",
      "Hypothyroidism",
      "Chronic constipation",
      "GERD (acid reflux)",
      "Osteoporosis",
      "Sleep apnea",
      "Chronic kidney disease",
      "Arthritis",
    ],
  },
  diets: {
    key: "diets",
    label: "Diet",
    empty: "No special diet on file",
    options: [
      "Diabetic diet",
      "Low sodium",
      "Low fat",
      "Calorie controlled",
      "High fiber",
      "Gluten free",
      "Dairy free",
      "Vegetarian",
      "Soft foods",
      "Cut into bite-size pieces",
      "Mechanical soft",
      "Ground",
      "Pureed",
      "Fluid limit",
      "Tube feeding (G-tube)",
    ],
  },
  swallowing_alerts: {
    key: "swallowing_alerts",
    label: "Swallowing alerts",
    empty: "No swallowing alerts on file",
    options: [
      "Choking risk",
      "Thickened liquids (nectar)",
      "Thickened liquids (honey)",
      "Thickened liquids (pudding)",
      "Small bites",
      "Slow pace",
      "No straws",
      "Sit upright to eat and for 30 minutes after",
      "Chin tuck when swallowing",
      "Stay with them while they eat",
    ],
  },
  mobility: {
    key: "mobility",
    label: "Mobility",
    empty: "No mobility needs on file",
    options: [
      "Walks on own",
      "Walks with help",
      "Cane",
      "Walker",
      "Manual wheelchair",
      "Power wheelchair",
      "Gait belt",
      "Transfer help (1 person)",
      "Transfer help (2 people)",
      "Hoyer lift",
      "Leg braces (AFOs)",
      "Fall risk",
      "Stairs with help",
      "No stairs",
      "Wheelchair-accessible vehicle",
    ],
  },
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The list as stored (null → empty). */
export function healthList(list: readonly string[] | null | undefined): string[] {
  return (list ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Common choices not already on the list. */
export function optionsToAdd(key: HealthListKey, list: readonly string[] | null | undefined) {
  const have = healthList(list);
  return HEALTH_LISTS[key].options.filter((o) => !have.some((h) => same(h, o)));
}

function clean(value: string, others: readonly string[]): string {
  const v = value.trim().replace(/\s+/g, " ");
  if (!v) throw new Error("Type what to add.");
  if (v.length > 200) throw new Error("Keep it under 200 characters.");
  if (others.some((o) => same(o, v))) throw new Error(`"${v}" is already on the list.`);
  return v;
}

/** The list with `value` added at the end. Throws when blank or already there. */
export function addHealthItem(list: readonly string[] | null | undefined, value: string): string[] {
  const have = healthList(list);
  return [...have, clean(value, have)];
}

/** The list with item `index` changed to `value`. Throws when blank or a duplicate. */
export function editHealthItem(
  list: readonly string[] | null | undefined,
  index: number,
  value: string,
): string[] {
  const have = healthList(list);
  if (index < 0 || index >= have.length) throw new Error("That item is no longer on the list.");
  const v = clean(
    value,
    have.filter((_, i) => i !== index),
  );
  return have.map((h, i) => (i === index ? v : h));
}

/** The list without item `index`. */
export function removeHealthItem(
  list: readonly string[] | null | undefined,
  index: number,
): string[] {
  return healthList(list).filter((_, i) => i !== index);
}

/** Emergency plan text as saved: trimmed, blank → null. */
export function cleanEmergencyPlan(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  return t ? t : null;
}
