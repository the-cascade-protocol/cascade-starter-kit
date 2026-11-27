// What the scripts share: where pods live, which pod a script works on, the app's own addresses, and what a script says
// when it stops.
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { env, exit, stderr } from "node:process";
import { fileURLToPath, URL } from "node:url";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import {
  messageOf,
  podNames,
  POD_NAME,
  restoreKits,
} from "cascade-runtime/app";
import { phaseOn, setUpTables } from "cascade-runtime/fixtures";
import { addresses } from "./addresses.ts";

/** Every pod of this app is a folder here, named as the pod. */
export const PODS = fileURLToPath(new URL("pods/", import.meta.url));
export const NO_POD =
  "No pod loaded. Run `npm run reset` to load Alex's, Priya's, Martin's and Tamsin's pods.";

export function podFolder(name: string): string {
  return join(PODS, name);
}

const ADDRESS = addresses();

/** The address of a pod's page. */
export const podPath = ADDRESS.pod;

/**
 * The address of a pod's trend: `test` is a LOINC code and `medication` an RxNorm code, or a name where the drug has no
 * code, both as bare as `find_changes` gives them; with no `medication`, none is marked.
 */
export const trendPath = ADDRESS.trend;

/** The origin `npm start` listens on, for a script that is not the server: `PORT`, else 3000. */
export function appOrigin(): string {
  return `http://127.0.0.1:${Number(env.PORT || 3000)}`;
}

/** `trendPath` on the app's origin: the address a model can be given. */
export function trendUrl(
  name: string,
  trend: Parameters<typeof trendPath>[1],
): string {
  return new URL(trendPath(name, trend), appOrigin()).href;
}

/** Removes every pod and every answer kept, and keeps the reference tables; gives the names of the pods there were. */
export async function deleteAll(): Promise<string[]> {
  const names = await podNames(PODS);
  let entries: string[];
  try {
    entries = await readdir(PODS);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT")
      return names;
    throw error;
  }
  for (const entry of entries)
    if (entry !== ".tables")
      await rm(join(PODS, entry), { recursive: true, force: true });
  return names;
}

/**
 * Removes every pod and loads the kits' pods again, the app as it was made: what `npm run reset` does. `out(text)`,
 * when given, is told what is under way: the tables' setup as its own step with each phase's seconds, then each kit
 * with its own. Gives the names of the pods there were.
 */
export async function resetAll(
  out?: (text: string) => void,
): Promise<string[]> {
  const names = await deleteAll();
  if (out !== undefined)
    try {
      await setUpTables(PODS, phaseOn(out));
    } catch (error) {
      out(`\nthe app's tables could not be set up: ${messageOf(error)}\n`);
    }
  await restoreKits(PODS, out);
  return names;
}

/** Says why, and ends the script with exit code 2. */
export function refuse(reason: string): never {
  stderr.write(`${reason}\n`);
  return exit(2);
}

export function checkName(name: string): string {
  if (!POD_NAME.test(name))
    refuse(
      `${name} is no pod name: use lower-case letters, digits, ".", "_" and "-", starting with a letter or digit`,
    );
  return name;
}

/**
 * The script's arguments: its options and exactly as many positionals as `positionals` names. npm keeps an option
 * given before `--` for itself, so a stray positional most often means that.
 */
export function argumentsOf<const Options extends ParseArgsOptionsConfig>(
  args: string[],
  usage: string,
  options: Options,
  positionals: number,
) {
  let parsed;
  try {
    parsed = parseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    return refuse(`${messageOf(error)}\nusage: ${usage}`);
  }
  if (parsed.positionals.length !== positionals)
    refuse(
      `usage: ${usage}\nAn option to an npm script goes after \`--\`, as \`npm run pod:load -- alex-rivera --through J24\`.`,
    );
  return parsed;
}

/** The pod named by `--pod`, or the only one there is. */
export async function choosePod(given: string | undefined): Promise<string> {
  const names = await podNames(PODS);
  if (given !== undefined) {
    checkName(given);
    if (!names.includes(given))
      refuse(
        names.length === 0
          ? `there is no pod ${given}. ${NO_POD}`
          : `there is no pod ${given}; there are ${names.join(", ")}`,
      );
    return given;
  }
  if (names.length === 0) refuse(NO_POD);
  if (names.length > 1)
    refuse(
      `there are several pods, ${names.join(", ")}: name one with \`-- --pod <name>\``,
    );
  return names[0];
}
