import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  closeStoryPods,
  HISTORY,
  LABS,
  REVIEW,
  said,
  storyPods,
} from "./fixtures.js";

after(closeStoryPods);

/**
 * A table opens in the order its tile says, and the page says a File menu's note in words. The rest of what a page says
 * is cascade-runtime/app's, which tests it.
 */
describe("Ordering a table's rows and saying a File menu's note · openingOrder(), didNote()", () => {
  describe("openingOrder(section, rows)", () => {
    const section = said.SECTIONS.find(
      ({ question }: { question: string }) => question === LABS,
    );
    const opened = (
      said.openingOrder(section, [
        { test: "Sodium" },
        { test: "Glucose", performed: "2024-03-01" },
        { test: "Potassium", performed: "2025-06-18T14:10:00-07:00" },
        { test: "Creatinine", performed: "2025-01-05" },
      ]) as { test: string }[]
    ).map(({ test }) => test);

    it("returns the lab results newest first", () => {
      assert.deepEqual(opened.slice(0, 3), [
        "Potassium",
        "Creatinine",
        "Glucose",
      ]);
    });

    it("puts a row with no date last", () => {
      assert.equal(opened.at(-1), "Sodium");
    });
  });

  describe("didNote(query, kits)", () => {
    const noted = (query: string, kits: string[] = []) =>
      said.didNote(new URLSearchParams(query), kits);

    it("says how many pods were deleted: `Deleted 3 pods.`, `Deleted 1 pod.`", () => {
      assert.equal(noted("deleted=3"), "Deleted 3 pods.");
      assert.equal(noted("deleted=1"), "Deleted 1 pod.");
    });

    it("says `There was no pod to delete.` for a count of none", () => {
      assert.equal(noted("deleted=0"), "There was no pod to delete.");
    });

    it("names the people whose pods are back after a reset: `Reset: Alex Rivera and Priya Natarajan are back.`", () => {
      assert.equal(
        noted("pod=alex-rivera&reset", ["alex-rivera", "priya-natarajan"]),
        "Reset: Alex Rivera and Priya Natarajan are back.",
      );
    });

    it("returns undefined for a count that is no whole number", () => {
      assert.equal(noted("deleted=some"), undefined);
    });

    it("returns undefined for a query that says neither", () => {
      assert.equal(noted("pod=alex-rivera"), undefined);
    });
  });
});

/**
 * An "Ask about this" button sends a first question that fits the kind of thing it sits beside, and an empty chat
 * offers up to four questions. Each is offered only when the pod holds what answers it.
 */
describe("Questions the chat offers before a person types · firstQuestion(), suggestedQuestions()", () => {
  describe("firstQuestion(context)", () => {
    for (const [context, question, title] of [
      [
        { kind: "finding", key: "k" },
        "What does this change show?",
        "returns `What does this change show?` for a lab change",
      ],
      [
        { kind: "trend", test: "t" },
        "What does this trend show?",
        "returns `What does this trend show?` for a trend",
      ],
      [
        { kind: "entry", id: "e" },
        "What is this, and where did it come from?",
        "returns `What is this, and where did it come from?` for a view entry",
      ],
      [
        { kind: "worth", entry: "e" },
        "What does this flag mean?",
        "returns `What does this flag mean?` for a Worth a look line",
      ],
    ] as const)
      it(title, () => {
        assert.equal(said.firstQuestion(context), question);
      });

    it("returns undefined for a kind it does not know, a name every object has, such as `toString`, included", () => {
      assert.equal(said.firstQuestion({ kind: "other" }), undefined);
      assert.equal(said.firstQuestion({ kind: "toString" }), undefined);
      assert.equal(said.firstQuestion(undefined), undefined);
    });
  });

  describe("suggestedQuestions(answers, { changes })", () => {
    const change = (n: number, dateIs: string) => ({
      kind: dateIs === "end of use" ? "after stop" : "after start",
      direction: "down",
      test: { code: `t${n}`, name: `Test ${n}` },
      medication: { code: `m${n}`, name: `Drug ${n}`, dateIs },
    });
    const FIRST = "Find anything interesting in this pod";
    let ines: string[];
    let finding: { test: { name: string }; medication: { name: string } };
    const many = said.suggestedQuestions(
      { [HISTORY]: [{ medication: "Drug 1", ended: "2024-05-01" }] },
      {
        changes: [
          change(1, "start of use"),
          change(2, "end of use"),
          change(3, "start of use"),
          change(4, "start of use"),
          change(5, "start of use"),
        ],
      },
    ) as string[];
    before(async () => {
      const story = (await storyPods()).get("story-statin")!;
      finding = story.changes[0] as unknown as typeof finding;
      ines = said.suggestedQuestions(story.answers, {
        changes: story.changes,
      }) as string[];
    });

    it("offers `Find anything interesting in this pod` first when the pod has a lab change", () => {
      assert.equal(ines[0], FIRST);
    });

    it("offers it too for a pod with a Worth a look line and no lab change", () => {
      assert.deepEqual(
        said.suggestedQuestions(
          {
            [HISTORY]: [],
            [LABS]: [],
            [REVIEW]: [
              { entry: "e1", needs: "judged different, still joined" },
            ],
          },
          { changes: [] },
        ),
        [FIRST],
      );
    });

    it("offers a question for each lab change, with its test and medication as the pod's screen names them", () => {
      assert.equal(
        ines[1],
        `Did ${finding.test.name} change after ${finding.medication.name} was prescribed?`,
      );
    });

    it("ends that question `was prescribed`, `started` or `stopped`, by the day the change is counted from", () => {
      assert.match(ines[1]!, / was prescribed\?$/);
      assert.equal(many[1], "Did Test 1 change after Drug 1 started?");
      assert.equal(many[2], "Did Test 2 change after Drug 2 stopped?");
    });

    it("offers `Which medications have I stopped?` last when a medication of the history has an end date", () => {
      assert.equal(many.at(-1), "Which medications have I stopped?");
    });

    it("offers four at most, the first and the last keeping their places", () => {
      assert.deepEqual(many, [
        FIRST,
        "Did Test 1 change after Drug 1 started?",
        "Did Test 2 change after Drug 2 stopped?",
        "Which medications have I stopped?",
      ]);
    });

    it("offers no question for a change with not enough results", () => {
      assert.deepEqual(
        said.suggestedQuestions(
          {},
          {
            changes: [
              { ...change(5, "start of use"), direction: "not enough results" },
            ],
          },
        ),
        [],
      );
    });

    it("offers none for a pod with nothing to ask about", () => {
      assert.deepEqual(said.suggestedQuestions({}, { changes: [] }), []);
    });
  });
});
