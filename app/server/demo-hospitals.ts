// The Node server's demo hospitals: the sandbox's, served from a listener of the app's own, as `podApi` reaches them.
import { URL } from "node:url";
import { brandsBundle, demoRemapFetch } from "@the-cascade-protocol/sandbox";
import type {
  LoadedHospital,
  serveDemo,
} from "@the-cascade-protocol/sandbox/node";
import { directoryOf, TEST_DIRECTORY } from "cascade-runtime";
import {
  type Hospitals,
  type SignedInAt,
  signIns,
  type World,
  worldOf,
} from "cascade-runtime/app";

/** A hospital's short name: a demo hospital's host, as `cascade-north`, or else its vendor. */
function idOf(row: { vendor: string; fhirBase: string }): string {
  return row.vendor === "demo"
    ? new URL(row.fhirBase).hostname.split(".")[0]
    : row.vendor;
}

/**
 * The hospitals and the world's date of the app at `origin`, for its host, and `back(url)` for its `/callback`. `demo`
 * is the demo hospitals as `loadHospitals` gives them, `listener` the running `serveDemo` listener that answers them,
 * as of `asOf` to start with. Each request goes to the listener through `demoRemapFetch`.
 */
export function nodeHospitals(
  origin: string,
  demo: readonly LoadedHospital[],
  {
    asOf,
    listener,
  }: {
    asOf: string | undefined;
    listener: Awaited<ReturnType<typeof serveDemo>>;
  },
): {
  hospitals: Hospitals;
  world: World;
  back(url: URL): SignedInAt | undefined;
} {
  /** The hospitals `demo` holds, the app's own among them, then the test directory's rows. */
  const directory = [
    ...directoryOf(
      brandsBundle(
        demo.map(({ hospital }) => hospital),
        new Date().toISOString(),
      ),
      "demo",
    ),
    ...TEST_DIRECTORY,
  ];
  const { signIn, back } = signIns();
  return {
    hospitals: {
      directory: async () => directory,
      registration: {
        clientId: "cascade-app",
        redirectUri: `${origin}/callback`,
      },
      fetch: demoRemapFetch(listener.origin),
      ready: async () => undefined,
      signIn,
      pullName: idOf,
    },
    world: worldOf(listener, asOf),
    back,
  };
}
