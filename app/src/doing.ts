// What the page is doing is `cascade-runtime/app`'s (`watchRouter`, `pageBusy`, `pageReady`, `pageFailed`: `data-state`
// on the body, which the suites wait on); this is what React tells it: the doing line, and what each commit drew.
import { useLayoutEffect, useSyncExternalStore } from "react";
import {
  useFetchers,
  useLocation,
  useMatches,
  useNavigation,
  useRevalidator,
} from "react-router";
import { onSaying, pageCommitted, sayingNow } from "cascade-runtime/app";

/** `sayingNow`, as a component reads it. */
export function useSaying(): string | undefined {
  return useSyncExternalStore(onSaying, sayingNow, sayingNow);
}

/** Tells the page what the commit that draws it drew, so that it says ready in no commit of an older state. */
export function PageState(): null {
  const location = useLocation();
  const navigation = useNavigation();
  const matches = useMatches();
  const fetchers = useFetchers();
  const { state: revalidation } = useRevalidator();
  useLayoutEffect(() =>
    pageCommitted({
      locationKey: location.key,
      navigation: navigation.state,
      revalidation,
      busyFetchers: fetchers.filter(({ state }) => state !== "idle").length,
      matches: matches.map(({ id, loaderData }) => ({ id, loaderData })),
    }),
  );
  return null;
}
