// The tools a model reaches the app by through the page's model context (WebMCP), on every screen, where the browser
// has one: `offerTools` of `cascade-runtime/app` registers them; this is what React gives it, the screen shown and the
// person's Allow, and what it takes away in the commit that draws the next screen.
import { useEffect, useLayoutEffect, useState } from "react";
import { offerTools, type ReadTool, toolsNow } from "cascade-runtime/app";
import { useLocation } from "react-router";
import { useToolSteps } from "./actions.tsx";
import { routed, useAddress } from "./address.tsx";
import { useHost } from "./api.tsx";
import { ACTIONS, SAID_NO, useConfirm } from "./confirm.tsx";

/** The pod last read as open: a locked pod is offered as no pod shown; `checked` is the pod that read was of. */
function useOpened(pod: string | undefined) {
  const { api } = useHost();
  const { pathname } = useLocation();
  const [read, setRead] = useState<{
    readonly checked: string | undefined;
    readonly opened: string | undefined;
  }>({ checked: undefined, opened: undefined });
  useEffect(() => {
    if (pod === undefined) return;
    let live = true;
    api.pod({ pod }).then(
      ({ locked }) =>
        live &&
        setRead({
          checked: pod,
          opened: locked === undefined ? pod : undefined,
        }),
      () => live && setRead({ checked: pod, opened: undefined }),
    );
    return () => {
      live = false;
    };
  }, [api, pod, pathname]);
  return read;
}

/**
 * Offers the model context every tool of the one list but the never list's, while the screen shown is `screen`. With a
 * pod shown, the tools of one pod take it as given; on a screen without one they take its name as `pod`. `open_pod`
 * always takes the name: it is how a model reaches another pod.
 */
export function useTools(screen: { readonly pod: string | undefined }) {
  const { api, reads } = useHost();
  const steps = useToolSteps();
  const confirm = useConfirm();
  const address = useAddress();
  const { opened, checked } = useOpened(screen.pod);
  const offered = screen.pod === undefined || checked === screen.pod;
  const pod =
    screen.pod !== undefined && opened === screen.pod ? screen.pod : undefined;
  const [listed, setListed] = useState<readonly ReadTool[]>();
  useEffect(() => {
    reads.list().then(setListed, () => setListed([]));
  }, [reads]);
  const [now] = useState(() => toolsNow({ confirm, offered }));
  useLayoutEffect(() => {
    now.set({ confirm, offered });
  });
  useLayoutEffect(() => {
    if (listed === undefined) return;
    return offerTools({
      api,
      reads,
      listed,
      pod,
      address,
      steps,
      now,
      actions: ACTIONS,
      said: SAID_NO,
      routed,
    });
  }, [api, reads, address, listed, pod, steps, now]);
}

/** Offers the model context its tools for the screen shown; it draws nothing. */
export function WebTools({ pod }: { pod: string | undefined }): null {
  useTools({ pod });
  return null;
}
