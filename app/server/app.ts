// The Node target's server: `appHandler` of `cascade-runtime/app` answers the guard, PodApi at `/api/`, the tools at
// `/tools`, the chat at `/chat` when the app has it, a hospital's redirect back at `/callback` and the demo people; this
// file hands it the pages: the built app's files as they are and its page for any other address a person opens, or in
// development Vite's.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  appHandler,
  type Launch,
  type Operations,
  type Own,
} from "cascade-runtime/app";
import { Hono } from "hono";
import { addresses } from "../addresses.ts";

type Bound = { Bindings: HttpBindings };

export interface Served {
  readonly api: Operations;
  /** This server's own addresses, known once it listens. */
  own(): Own;
  /** What the printed address `/?launch=<token>` trades for the cookie every route that reads a pod asks for. */
  readonly launch: Launch;
  /** `GET /chat` and `POST /chat`, when the chat add-on is added (`chat.ts`); without it `/chat` is a 404. */
  readonly chat?: Hono;
  /** The sign-in a hospital's redirect to `/callback` finishes, as `{ pod, connection }`; none when none waits. */
  back(url: URL): { pod: string; connection: number } | undefined;
  /** The demo people the hospitals hold, as `demoPeople` gives them, at `/demo-people.json`; none when not given. */
  people?(): readonly object[];
  /** The built app's folder, or in development what answers a request with Vite's pages, given the request's bindings. */
  readonly pages: string | ((bindings: HttpBindings) => Promise<Response>);
}

const ADDRESS = addresses();

/** What the handler answers itself, served or not, and never as the app's page: the routes that read a pod. */
const SERVED = /^\/(?:api\/|tools(?:\/|$)|chat$)/;

/**
 * An address a person opens rather than a file a page reads. An id may hold a dot, so a last part with one is a page
 * only when the request is a navigation or asks for HTML.
 */
const isPage = (path: string, headers: Headers) =>
  !SERVED.test(path) &&
  (!/\.[^/]*$/.test(path) ||
    headers.get("sec-fetch-mode") === "navigate" ||
    (headers.get("accept") ?? "").includes("text/html"));

/** `app` serving the built app in `folder`: its files as they are, and its `index.html` for any page a person opens. */
export function withPages<T extends Hono<Bound>>(app: T, folder: string): T {
  let page: Promise<string> | undefined;
  app.get("*", serveStatic({ root: folder }), async (c, next) => {
    if (!isPage(c.req.path, c.req.raw.headers)) return next();
    page ??= readFile(join(folder, "index.html"), "utf8");
    return c.html(await page);
  });
  return app;
}

/** What the chat add-on's `server/chat.ts` gives the server: its routes over `api`, with the model the app was set up with. */
export type ChatServed = (api: Operations) => Hono;

export function appServer(served: Served) {
  const { chat, pages } = served;
  const built =
    typeof pages === "string"
      ? withPages(new Hono<Bound>(), pages).notFound((c) =>
          c.text("Not found", 404),
        )
      : undefined;
  const pagesOf = (bindings: HttpBindings) =>
    typeof pages === "string"
      ? (request: Request) => built!.fetch(request)
      : () => pages(bindings);
  const handle = appHandler({
    api: served.api,
    own: served.own,
    launch: served.launch,
    address: ADDRESS,
    back: served.back,
    ...(served.people === undefined ? {} : { people: served.people }),
    ...(chat === undefined
      ? {}
      : { chat: (request: Request) => chat.fetch(request) }),
    pagesNeedLaunch: typeof pages !== "string",
  });
  return new Hono<Bound>().all("*", (c) => handle(c.req.raw, pagesOf(c.env)));
}
