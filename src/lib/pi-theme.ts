/**
 * Provider Interface visual tokens for JS consumers (inline styles, the
 * in-app certificate, the training engine). Values are the Denim design
 * system — the same numbers as the --denim-* CSS variables in
 * src/styles/hive-theme.css, read from DENIM in design-tokens.ts so they
 * cannot drift. Prefer the CSS variables / Tailwind utilities in components.
 *
 * Key names are kept from the earlier palette so importers keep compiling:
 * `navy`/`n*` are Denim blues, `cream` is the paper surface, `gold` /
 * `goldSoft` now carry the Denim green accent (no gold anywhere) and `amber`
 * is the warning status text.
 */

import { DENIM, DENIM_FONTS, DENIM_STATUS } from "./design-tokens.ts";

export const PI_THEME = {
  navy: DENIM.deep,
  n1: DENIM.pri,
  n2: DENIM.pt,
  n3: DENIM.pt2,
  sideTop: DENIM.deep,
  sideBot: DENIM.pri,
  /** Paper surface (was the cream canvas). */
  cream: DENIM.paper,
  /** Text ramp on light surfaces. */
  c70: DENIM.text,
  c50: DENIM.muted,
  c30: DENIM.pt2,
  c14: DENIM.line,
  c08: DENIM.line,
  c04: DENIM.pt0,
  /** Denim green accent (key name kept for importers). */
  gold: DENIM.accd,
  /** Denim green tint (key name kept for importers). */
  goldSoft: DENIM.acct,
  accent: DENIM.acc,
  accentText: DENIM.accd,
  accentSoft: DENIM.acct,
  ok: DENIM.acc,
  red: DENIM_STATUS.danger,
  /** Warning text — status meaning kept (key name kept for importers). */
  amber: DENIM_STATUS.warnText,
  /** Heading face (Manrope). Key name kept for importers. */
  serif: DENIM_FONTS.heading,
  sans: DENIM_FONTS.body,
  shadow1:
    "0 0 0 1px rgba(27, 51, 80, 0.08), 0 1px 2px rgba(27, 51, 80, 0.05), 0 8px 20px -14px rgba(27, 51, 80, 0.28)",
  shadow2:
    "0 0 0 1px rgba(27, 51, 80, 0.08), 0 2px 4px rgba(27, 51, 80, 0.05), 0 24px 56px -20px rgba(27, 51, 80, 0.32)",
  cardBg: DENIM.paper,
  /** Navy feature band (CSS var; PI_THEME is only used in inline styles). */
  heroTileBg: "var(--denim-band)",
  hairlines: {
    faint: DENIM.line,
    soft: DENIM.line,
    mid: DENIM.pt2,
  },
  buttons: {
    primaryBg: DENIM.pri,
    primaryFg: DENIM.paper,
    primaryShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 10px 24px -10px rgba(39, 76, 119, 0.55)",
    secondaryBg: "rgba(255, 255, 255, 0.55)",
    secondaryFg: DENIM.pri,
    secondaryBorder: DENIM.pt2,
  },
  avatarBg: [DENIM.pt, DENIM.pt2] as const,
  pageGlow: `radial-gradient(52vw 52vw at 0% 0%, ${DENIM.pt2}, transparent 70%), radial-gradient(44vw 44vw at 100% 30%, ${DENIM.acclh}, transparent 70%), radial-gradient(36vw 36vw at 55% 100%, rgba(96, 150, 186, 0.35), transparent 70%)`,
  grainOpacity: 0,
} as const;

export type PiTheme = typeof PI_THEME;
