import { useLayoutEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PiPublicHeader } from "@/components/pi-landing/pi-public-header";
import { PiPublicFooter } from "@/components/pi-landing/pi-public-footer";
import { applyPublicPageScroll } from "@/lib/pi-public-scroll";

export function usePiLandingHtmlClass() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("pi-html-landing");
    return () => root.classList.remove("pi-html-landing");
  }, []);
}

export function usePiPublicPageScroll() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  useLayoutEffect(() => {
    applyPublicPageScroll(hash);
  }, [pathname, hash]);
}

/**
 * Denim public shell: floating glass nav, light canvas with the ambient
 * field, solid navy footer. `surface="paper"` (sign in / sign up) uses the
 * same chrome with a fainter ambient glow so the form card reads first.
 */
export function PiPublicPage({
  children,
  home = false,
  surface = "navy",
}: {
  children: ReactNode;
  home?: boolean;
  surface?: "navy" | "paper";
}) {
  usePiLandingHtmlClass();
  usePiPublicPageScroll();
  return (
    <div className={surface === "paper" ? "pi-landing-root pi-home pi-home-paper" : "pi-landing-root pi-home"}>
      <div className="denim-field" aria-hidden>
        <div className="denim-orb" />
      </div>
      <PiPublicHeader home={home} />
      {children}
      <PiPublicFooter />
    </div>
  );
}
