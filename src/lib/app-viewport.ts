/**
 * Visible-viewport lock for in-app shells (admin chrome + staff phone).
 *
 * iOS Safari's `100vh` is the *large* viewport — it includes the area behind
 * the URL bar and the bottom toolbar. A `h-screen` / `overflow-hidden` shell
 * then paints under that chrome: the first rows tuck under the top bar and
 * the last rows cannot be scrolled into view.
 *
 * `visualViewport.height` is the pixels the user can actually see. We write
 * that onto `--app-vh` / `--app-vt` and size `[data-app-shell]` with those
 * variables. CSS fallback is `100svh` (smallest viewport), never `100vh`.
 */

export const APP_VH_VAR = "--app-vh";
export const APP_VT_VAR = "--app-vt";

export const APP_VIEWPORT_BOOT_SCRIPT =
  '(()=>{try{var v=window.visualViewport,h=(v&&v.height)||window.innerHeight,t=(v&&v.offsetTop)||0;document.documentElement.style.setProperty("--app-vh",h+"px");document.documentElement.style.setProperty("--app-vt",t+"px");}catch(e){}})();';

export function readVisibleViewportHeight(
  viewport: { height: number } | null | undefined,
  innerHeight: number,
): number {
  const raw = viewport && Number.isFinite(viewport.height) ? viewport.height : innerHeight;
  if (!Number.isFinite(raw) || raw <= 0) {
    return Number.isFinite(innerHeight) && innerHeight > 0 ? innerHeight : 0;
  }
  return raw;
}

export function readVisibleViewportOffsetTop(
  viewport: { offsetTop: number } | null | undefined,
): number {
  const raw = viewport?.offsetTop ?? 0;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

export function applyAppViewportVars(
  style: { setProperty: (name: string, value: string) => void },
  viewport: { height: number; offsetTop: number } | null | undefined,
  innerHeight: number,
): { height: number; offsetTop: number } {
  const height = readVisibleViewportHeight(viewport, innerHeight);
  const offsetTop = readVisibleViewportOffsetTop(viewport);
  style.setProperty(APP_VH_VAR, `${height}px`);
  style.setProperty(APP_VT_VAR, `${offsetTop}px`);
  return { height, offsetTop };
}

export function installAppViewportSync(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const apply = () => {
    applyAppViewportVars(document.documentElement.style, window.visualViewport, window.innerHeight);
  };
  apply();
  const vv = window.visualViewport;
  vv?.addEventListener("resize", apply);
  vv?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  return () => {
    vv?.removeEventListener("resize", apply);
    vv?.removeEventListener("scroll", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
  };
}
