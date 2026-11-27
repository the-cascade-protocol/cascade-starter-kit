// What the app's own pages say: its tiles and their words, the order a table opens in, the chart's geometry, and the
// words of its menus, forms and chat. What any app showing a pod says the same way is `cascade-runtime/app`'s; the
// tiles are handed to it (`podApi(host, { sections: SECTIONS })`), so a tile changed here is followed there.

import {
  type Abouts,
  type Answers,
  changeNames,
  type Column as ShownColumn,
  compare,
  day,
  type Finding,
  HISTORY,
  LABS,
  listed,
  medicationDay,
  personName,
  rounded,
  rowsOf,
  type Section as ShownSection,
  type SectionRow,
  variantRows,
  type VariantsSaid,
  worthALook,
} from "cascade-runtime/app";
import { terms } from "cascade-runtime/terms";

/** What a column of a section's table sorts and shows. */
export type ColumnType = "text" | "date" | "number";
/** A column of a section's table: what a cell shows, and what the column sorts by. */
export interface Column extends ShownColumn {
  readonly type: ColumnType;
  key(row: SectionRow): string | number | undefined;
  warm?(row: SectionRow): boolean;
  readonly tag?: boolean;
}
/** A tile of a pod's page, as `SECTIONS` holds them. */
export interface Section extends ShownSection {
  readonly title: string;
  readonly columns: readonly Column[];
  current?(row: SectionRow): boolean;
  readonly sortBy: number;
  readonly newestFirst?: boolean;
}

const text = (head: string, of: (row: SectionRow) => string): Column => ({
  head,
  type: "text",
  key: of,
  show: of,
});
const date = (head: string, of: (row: SectionRow) => string): Column => ({
  head,
  type: "date",
  key: of,
  show: (row) => day(of(row)),
});
const number = (
  head: string,
  of: (row: SectionRow) => string | number | undefined,
): Column => ({
  head,
  type: "number",
  key: of,
  show: (row) => rounded(of(row)),
});

const SEVERITY: Readonly<Record<string, string>> = {
  high: "High severity",
  low: "Low severity",
};

const ACTIVE = terms.MedicationActive;
const STOPPED = terms.MedicationStopped;
const UNKNOWN = terms.MedicationUnknown;
const ENTERED_IN_ERROR = terms.MedicationEnteredInError;

/**
 * The lifecycle classes of rule L1 a person is shown, in the order the Medications table opens in, each with its word.
 * A medication of any but the last is current. Entered in error is not among them: such a medication is not shown.
 */
const LIFECYCLES = [
  [ACTIVE, "Active"],
  [terms.MedicationPaused, "Paused"],
  [UNKNOWN, "Unknown"],
  [STOPPED, "Stopped"],
].map(([lifecycle, said], order) => ({ lifecycle, said, order }));

/** A medication row's lifecycle class, as `LIFECYCLES` holds it: unknown when the row states none. */
const lifecycleOf = (row: SectionRow) =>
  LIFECYCLES.find(({ lifecycle }) => lifecycle === row.lifecycle) ??
  LIFECYCLES.find(({ lifecycle }) => lifecycle === UNKNOWN)!;

const isCurrent = (row: SectionRow) => lifecycleOf(row).lifecycle !== STOPPED;

/**
 * A medication's status in a person's words: its lifecycle class, with the day it stopped, or, for one not stopped
 * that states an end, the day it runs until.
 */
function medicationStatus(row: SectionRow): string {
  const { lifecycle, said } = lifecycleOf(row);
  if (row.ended === undefined) return said;
  return lifecycle === STOPPED
    ? `${said} ${day(row.ended)}`
    : `${said}, until ${day(row.ended)}`;
}

/**
 * One tile for each of these questions, in this order: its title, what one of its rows is called, the column of the
 * record's own name for it, the columns holding its codes in the order a name is taken from them, the table's columns,
 * the column the table opens sorted by, and whether it opens with the newest first; and, for a section that has them,
 * which of its question's rows it shows and which of those are current, the tile counting and naming the current ones.
 */
export const SECTIONS: readonly Section[] = [
  {
    title: "Allergies",
    one: "allergy",
    question: "pod/My active allergies",
    field: "allergenName",
    codes: ["code"],
    columns: [
      text("Allergen", (row) => row.allergenName),
      {
        head: "Severity",
        type: "number",
        key: (row) =>
          String(
            row.criticality === undefined
              ? 4
              : (({ high: 1, low: 2 } as Readonly<Record<string, number>>)[
                  row.criticality
                ] ?? 3),
          ),
        show: (row) =>
          row.criticality === undefined
            ? ""
            : (SEVERITY[row.criticality] ??
              row.criticality.replaceAll("-", " ")),
        warm: (row) => row.criticality === "high",
        tag: true,
      },
    ],
    sortBy: 1,
  },
  {
    title: "Medications",
    one: "medication",
    question: "pod/My medication history",
    field: "medication",
    codes: ["code"],
    shows: (row) => row.lifecycle !== ENTERED_IN_ERROR,
    current: isCurrent,
    columns: [
      text("Medication", (row) => row.medication),
      {
        head: "Status",
        type: "text",
        key: (row) =>
          `${lifecycleOf(row).order} ${isCurrent(row) ? "" : (row.ended ?? "")} ${row.medication ?? ""}`,
        show: medicationStatus,
      },
      date("Since", (row) => row.started),
      date("Prescribed", (row) => row.written),
    ],
    sortBy: 1,
  },
  {
    title: "Conditions",
    one: "condition",
    question: "pod/My active conditions",
    field: "condition",
    codes: ["conditionCode"],
    columns: [
      text("Condition", (row) => row.condition),
      date("Since", (row) => row.onset),
    ],
    sortBy: 0,
  },
  {
    title: "Lab results",
    one: "lab result",
    question: "pod/My lab results",
    field: "test",
    codes: ["code"],
    columns: [
      text("Test", (row) => row.test),
      number("Value", (row) => row.value),
      text("Unit", (row) => row.unit),
      date("Date", (row) => row.performed),
    ],
    sortBy: 3,
    newestFirst: true,
  },
  {
    title: "Immunizations",
    one: "immunization",
    question: "pod/My immunizations",
    field: "vaccine",
    codes: ["code"],
    columns: [
      text("Vaccine", (row) => row.vaccine),
      date("Date", (row) => row.given),
    ],
    sortBy: 1,
    newestFirst: true,
  },
  {
    title: "Procedures",
    one: "procedure",
    question: "pod/My procedures",
    field: "procedure",
    codes: ["procedureCode"],
    columns: [
      text("Procedure", (row) => row.procedure),
      date("Date", (row) => row.performed),
    ],
    sortBy: 1,
    newestFirst: true,
  },
  {
    title: "Genetic variants",
    one: "variant",
    field: "variant",
    codes: [],
    rows: variantRows,
    columns: [
      text("Variant", (row) => row.variant),
      number("Reports", (row) => row.reports),
    ],
    sortBy: 0,
  },
];

/** The section's rows in the order its table opens in, a row with nothing to sort by last either way. */
export function openingOrder(
  section: Section,
  rows: readonly SectionRow[],
): SectionRow[] {
  const column = section.columns[section.sortBy];
  const key = (row: SectionRow) => String(column.key(row) ?? "");
  const order = section.newestFirst ? -1 : 1;
  return [...rows].sort(
    (a, b) =>
      Number(key(a) === "") - Number(key(b) === "") ||
      order * compare(column.type, key(a), key(b)),
  );
}

/** A point of a chart: a day, as a time, and a value. */
export interface Point {
  readonly time: number;
  readonly value: number;
}
/** A day marked across a chart. */
export interface Mark {
  readonly time: number;
  readonly kind: string;
  readonly text: string;
}
/** The size of a chart. */
export interface Size {
  readonly width: number;
  readonly height: number;
  readonly margin: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly radius: number;
}
/** Where times and values fall in a chart, as `plotOf` gives it. */
export interface Plot extends Size {
  readonly from: number;
  readonly to: number;
  readonly low: number;
  readonly high: number;
  x(time: number): number;
  y(value: number): number;
}

export const DAY_MS = 86_400_000;
export const timeOf = (text: string) =>
  Date.parse(`${String(text).slice(0, 10)}T00:00:00Z`);
export const dayAt = (time: number) => day(new Date(time).toISOString());
export const monthAt = (time: number) =>
  new Date(time).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const near = (n: number) => Math.round(n * 10) / 10;

/** Where a time and a value fall in a drawing of `size`, over the days and numbers of `points` and `marks`. */
export function plotOf({
  points,
  marks = [],
  size,
}: {
  points: readonly Point[];
  marks?: readonly Mark[];
  size: Size;
}): Plot {
  const { width, height, margin } = size;
  const times = [
    ...points.map(({ time }) => time),
    ...marks.map(({ time }) => time),
  ];
  let from = Math.min(...times);
  let to = Math.max(...times);
  if (from === to) {
    from -= DAY_MS;
    to += DAY_MS;
  }
  const values = points.map(({ value }) => value);
  let low = Math.min(...values);
  let high = Math.max(...values);
  const pad = (high - low) * 0.1 || Math.abs(low) * 0.1 || 1;
  low -= pad;
  high += pad;
  const across = width - margin.left - margin.right;
  const down = height - margin.top - margin.bottom;
  return {
    ...size,
    from,
    to,
    low,
    high,
    x: (time) => margin.left + ((time - from) / (to - from)) * across,
    y: (value) => margin.top + (1 - (value - low) / (high - low)) * down,
  };
}

export const SMALL: Size = {
  width: 240,
  height: 84,
  margin: { top: 8, right: 8, bottom: 8, left: 8 },
  radius: 3,
};
export const LARGE: Size = {
  width: 640,
  height: 280,
  margin: { top: 30, right: 36, bottom: 34, left: 60 },
  radius: 4,
};

/** `count` values from `from` to `to`, evenly. */
export const spread = (count: number, from: number, to: number) =>
  Array.from(
    { length: count },
    (_, at) => from + ((to - from) * at) / (count - 1),
  );

export const LAB_SECTION = SECTIONS.find(({ question }) => question === LABS)!;

/** The id of the new-pod box's checkbox, and the name of the field it adds to whichever form makes the pod. */
export const ENCRYPT_BOX = "encrypt-pod";
export const ENCRYPT_FIELD = "encrypt";

/** A hospital's name as a person says it: `Cascade North Demo Hospital` is `Cascade North`. */
export const hospitalName = (name: string) =>
  name.replace(/ Demo Hospital$/, "");

/** What a connection's box says while it brings a record in. */
export const BRINGING = "Bringing the record in…";

/**
 * What the page says after a File menu item, from its address's `query`: `deleted=<n>`, how many pods went; `reset`,
 * that the pods `kits` are back; else undefined.
 */
export function didNote(
  query: { get(name: string): string | null; has(name: string): boolean },
  kits: readonly string[],
): string | undefined {
  const deleted = query.get("deleted");
  if (deleted !== null && /^\d+$/.test(deleted)) {
    const count = Number(deleted);
    return count === 0
      ? "There was no pod to delete."
      : `Deleted ${count} ${count === 1 ? "pod" : "pods"}.`;
  }
  if (query.has("reset"))
    return `Reset: ${listed(kits.map((kit) => personName(kit)))} ${kits.length === 1 ? "is" : "are"} back.`;
  return undefined;
}

/** The question a click on an "Ask about this" button for `context` sends at once; undefined for a kind it does not know. */
export function firstQuestion(
  context: { readonly kind?: string } | undefined,
): string | undefined {
  const questions: Readonly<Record<string, string>> = {
    finding: "What does this change show?",
    trend: "What does this trend show?",
    entry: "What is this, and where did it come from?",
    worth: "What does this flag mean?",
  };
  return Object.hasOwn(questions, context?.kind as PropertyKey)
    ? questions[context!.kind!]
    : undefined;
}

/** The most questions an empty chat offers. */
const SUGGESTED = 4;

/**
 * The questions an empty chat offers, as texts: at most `SUGGESTED`, in a fixed order, the same for the same input,
 * and each only when the pod holds what answers it. First "Find anything interesting in this pod", when What changed
 * has a change or Worth a look has a line (`worth_a_look` gives the lines); then, for each change shown, strongest first, "Did <test> change after
 * <medication> started?" (or "was prescribed", or "stopped", as `medicationDay` says), named as its card names them; last "Which medications have I stopped?", when a
 * medication of the history has an end date. The changes make room for the other two. `answers` holds the rows of each
 * question the tiles ask, by question, and `changes`, `about` and `said` are as `podPage` takes them.
 */
export function suggestedQuestions(
  answers: Answers,
  {
    changes = [],
    about = new Map(),
    said,
  }: { changes?: readonly Finding[]; about?: Abouts; said?: VariantsSaid },
): string[] {
  const shown = changes.filter(
    ({ direction }) => direction !== "not enough results",
  );
  const first =
    shown.length > 0 || worthALook(answers, about, said, SECTIONS).length > 0
      ? ["Find anything interesting in this pod"]
      : [];
  const last = rowsOf(answers, HISTORY).some((row) => row.ended)
    ? ["Which medications have I stopped?"]
    : [];
  const changed = [
    ...new Set(
      shown.map((finding) => {
        const names = changeNames(finding, about);
        return `Did ${names.test} change after ${names.medication} ${medicationDay(finding).said}?`;
      }),
    ),
  ].slice(0, SUGGESTED - first.length - last.length);
  return [...first, ...changed, ...last];
}
