/**
 * beforeLoad re-runs on every navigation — including ones that only change
 * search params (roster filter, sort, search). A route's `cause` is "stay"
 * whenever the route stays matched, so on the root route it is "stay" on
 * every client-side page change, and on /dashboard for every dashboard page.
 * "stay" alone therefore does NOT mean "same page": the pathname has to match
 * the last one this gate checked too.
 *
 * One gate per route. Records only real client navigations (never SSR — the
 * module is shared across requests — and never preloads, which don't move
 * the user). Record before any early return, so a redirected navigation still
 * leaves the next one comparing against the right path.
 */
export type BeforeLoadCause = "preload" | "enter" | "stay";

export function createSamePageGate() {
  let lastPathname: string | null = null;
  return {
    /** True when this navigation only changed search params: skip the checks. */
    skip(cause: BeforeLoadCause, pathname: string): boolean {
      if (typeof window === "undefined" || cause === "preload") return false;
      const same = cause === "stay" && pathname === lastPathname;
      lastPathname = pathname;
      return same;
    },
  };
}
