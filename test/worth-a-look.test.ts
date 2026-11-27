import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { loadHospital } from "@the-cascade-protocol/sandbox/node";
import { openPod, pullFiles } from "cascade-runtime";
import { nodeHost, podApi } from "cascade-runtime/app";
import { replayKit } from "cascade-runtime/fixtures";
import { importClaimingEveryProfile } from "./claiming.js";
import { pulled } from "./hospitals.js";
import { removed } from "./settled.js";

const { SECTIONS } = (await import(
  new URL("../../app/said.ts", import.meta.url).href
)) as { SECTIONS: NonNullable<Parameters<typeof podApi>[1]>["sections"] };

const STATIN = "story-statin";
const ATORVASTATIN = "617310";
const SECOND_ATORVASTATIN = "617314";

type Line = { sentence: string; tag?: string };

/** What `worth_a_look` says of `pod`, over the reference tables the installed cascade-runtime carries and the app's tiles. */
let folder: string;
let worth: (pod: string) => Promise<Line[]>;
let api: ReturnType<typeof podApi>;

/** Martin's kit pod, and the statin story's with a second atorvastatin of another strength. */
before(
  async () => {
    folder = await mkdtemp(join(tmpdir(), "worth-a-look-"));
    await replayKit("martin-okafor", join(folder, "martin-okafor"));
    const { pull } = await pulled(await loadHospital("cascade-north"), STATIN);
    const files = pullFiles(pull, "north");
    const bundle = JSON.parse(
      new TextDecoder().decode(files.get("north/bundle.json")),
    );
    const [first] = bundle.entry.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ resource }: { resource: any }) =>
        resource.resourceType === "MedicationRequest" &&
        resource.medicationCodeableConcept.coding[0].code === ATORVASTATIN,
    );
    const [coding] = first.resource.medicationCodeableConcept.coding;
    bundle.entry.push({
      ...first,
      fullUrl: first.fullUrl.replace("med-1", "med-3"),
      resource: {
        ...first.resource,
        id: "story-statin-med-3",
        medicationCodeableConcept: {
          coding: [
            {
              ...coding,
              code: SECOND_ATORVASTATIN,
              display: "atorvastatin 40 MG Oral Tablet",
            },
          ],
          text: "Atorvastatin 40 mg tablet",
        },
      },
    });
    const pod = await openPod(join(folder, "two-atorvastatins"));
    const imported = await importClaimingEveryProfile(
      pod,
      new Map([
        ...files,
        ["north/bundle.json", new TextEncoder().encode(JSON.stringify(bundle))],
      ]),
    );
    assert.equal(imported.refused, undefined);
    await pod.close();
    api = podApi(nodeHost({ folder }), { sections: SECTIONS });
    worth = async (name) =>
      (await api.tool({ pod: name, tool: "worth_a_look" })).value as Line[];
  },
  { timeout: 300_000 },
);

after(async () => {
  await api?.close();
  await removed(folder);
});

describe("Saying what is worth a look over the reference tables cascade-runtime carries · api.tool(), worth_a_look", () => {
  describe("given the reference tables cascade-runtime carries, in place of a stub", () => {
    it("says from `worth_a_look` two medications that share an ingredient, with the ingredient's name", async () => {
      const lines = await worth("two-atorvastatins");
      assert.ok(
        lines.some(({ sentence }) =>
          /share an ingredient, atorvastatin/.test(sentence),
        ),
        JSON.stringify(lines),
      );
    });

    it("says from `worth_a_look` a report that differs from ClinVar today", async () => {
      const lines = await worth("martin-okafor");
      const differing = lines.filter(({ tag }) => tag === "Differs");
      assert.ok(differing.length > 0, JSON.stringify(lines));
      assert.match(
        differing[0]!.sentence,
        /2022 report.* differs from ClinVar today\.$/,
      );
    });
  });
});
