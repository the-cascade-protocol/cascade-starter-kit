import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { launchCookie, newLaunch } from "cascade-runtime/app";

interface App {
  request(input: string, init?: RequestInit): Promise<Response>;
  fetch(request: Request, env?: unknown): Response | Promise<Response>;
}
const { appServer } = (await import(
  new URL("../../app/server/app.ts", import.meta.url).href
)) as {
  appServer: (served: {
    api: object;
    own: () => { hosts: Set<string>; origins: Set<string> };
    launch: ReturnType<typeof newLaunch>;
    back: () => undefined;
    pages: string | ((bindings: object) => Promise<Response>);
  }) => App;
};

const own = () => ({
  hosts: new Set(["localhost"]),
  origins: new Set<string>(),
});
const folders: string[] = [];
after(async () => {
  for (const each of folders) await rm(each, { recursive: true, force: true });
});

/**
 * The app is one page that draws every screen, so the server returns that page for any address a person opens, and
 * a file only at the file's own address. A view entry's id may hold a dot, so the server tells a screen's address
 * from a file's by what the browser says it wants.
 */
describe("Answering an address a person opens with the app's page · appServer()", () => {
  describe("appServer({ pages })", () => {
    let get: (
      path: string,
      headers?: Record<string, string>,
    ) => Promise<readonly [number, string]>;
    before(async () => {
      const pages = await mkdtemp(join(tmpdir(), "pages-"));
      folders.push(pages);
      await writeFile(join(pages, "index.html"), "<h1>the app</h1>");
      await writeFile(join(pages, "app.js"), "1");
      const app = appServer({
        api: {},
        own,
        launch: newLaunch(),
        back: () => undefined,
        pages,
      });
      get = async (path, headers = {}) => {
        const response = await app.request(`http://localhost${path}`, {
          headers,
        });
        return [response.status, await response.text()] as const;
      };
    });

    it("returns the app's page for a screen's address with a dot in it, when the browser is navigating", async () => {
      assert.deepEqual(
        await get("/pods/a/entries/x.1", { "sec-fetch-mode": "navigate" }),
        [200, "<h1>the app</h1>"],
      );
    });

    it("returns the app's page for that address when the request accepts HTML", async () => {
      assert.deepEqual(
        await get("/pods/a/entries/x.1", { accept: "text/html" }),
        [200, "<h1>the app</h1>"],
      );
    });

    it("returns a file of the built app at the file's own address", async () => {
      assert.deepEqual(await get("/app.js"), [200, "1"]);
    });

    it("responds 404 for a file there is not", async () => {
      assert.equal((await get("/nope.json"))[0], 404);
    });

    it("responds 404 for an address with a dot in it that asks for no page", async () => {
      assert.equal((await get("/pods/a/entries/x.1"))[0], 404);
    });
  });

  describe("given pages that are a function, as `npm run dev` gives them", () => {
    const at = "http://app.test";

    it("gives the function the connection the request came on, once the request holds the launch cookie, and answers what it answers", async () => {
      const launch = newLaunch();
      const bindings = { incoming: "the request", outgoing: "the response" };
      const reached: unknown[] = [];
      const app = appServer({
        api: {},
        own: () => ({ hosts: new Set(["app.test"]), origins: new Set() }),
        launch,
        back: () => undefined,
        pages: async (given) => {
          reached.push(given);
          return new Response("vite's page");
        },
      });
      const cookie = `${launchCookie(new URL(at))}=${launch.exchange(launch.token)}`;
      const asked = (headers: Record<string, string>) =>
        app.fetch(
          new Request(`${at}/pods/a/`, {
            headers: { host: "app.test", ...headers },
          }),
          bindings,
        );
      assert.equal((await asked({})).status, 403);
      assert.deepEqual(reached, [], "no page is asked for without the cookie");
      const answered = await asked({ cookie });
      assert.equal(await answered.text(), "vite's page");
      assert.deepEqual(reached, [bindings]);
    });
  });
});
