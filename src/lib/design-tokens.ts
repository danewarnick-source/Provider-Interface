/**
 * Provider Interface design tokens — TypeScript mirror of CSS custom properties.
 * Source of truth for values: src/styles/hive-theme.css (imported via styles.css).
 *
 * Use CSS variables in components; import this module when you need token names
 * in JS (charts, inline styles, tests).
 */

/** Semantic color tokens (map to --hive-* / shadcn vars in hive-theme.css). */
export const colors = {
  brand: {
    navy: "var(--hive-sidebar)",
    gold: "var(--hive-gold)",
    goldHover: "var(--hive-gold-hover)",
    goldSoft: "var(--hive-gold-soft)",
    onGold: "var(--hive-on-gold)",
    cream: "var(--hive-chrome-text)",
  },
  surface: {
    page: "var(--hive-canvas)",
    card: "var(--hive-surface)",
    muted: "var(--hive-muted-surface)",
    sidebar: "var(--hive-sidebar)",
    modal: "var(--hive-surface)",
    input: "var(--hive-surface)",
  },
  text: {
    primary: "var(--hive-text)",
    muted: "var(--hive-text-muted)",
    chrome: "var(--hive-chrome-text)",
    onPrimary: "var(--primary-foreground)",
  },
  border: {
    default: "var(--hive-border)",
    divider: "var(--hive-border)",
    focus: "var(--hive-gold)",
  },
  state: {
    success: "var(--hive-ok)",
    successFg: "var(--hive-ok-fg)",
    successSoft: "var(--hive-ok-soft)",
    warning: "var(--hive-gold)",
    warningFg: "var(--hive-on-gold)",
    warningSoft: "var(--hive-gold-soft)",
    error: "var(--hive-danger)",
    errorFg: "var(--hive-danger-fg)",
    errorSoft: "var(--hive-danger-soft)",
    info: "var(--hive-info)",
    infoFg: "var(--hive-info-fg)",
    infoSoft: "var(--hive-info-soft)",
  },
} as const;

/** Typography scale — matches @layer base in styles.css. */
export const typography = {
  fontFamily: {
    sans: 'var(--font-sans)',
    display: 'var(--font-display)',
  },
  fontSize: {
    xs: "var(--text-xs)",
    sm: "var(--text-sm)",
    base: "var(--text-base)",
    lg: "var(--text-lg)",
    xl: "var(--text-xl)",
    "2xl": "var(--text-2xl)",
    "3xl": "var(--text-3xl)",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.15",
    snug: "1.35",
    normal: "1.55",
    relaxed: "1.65",
  },
} as const;

/** Spacing scale (4px base). */
export const spacing = {
  0: "0",
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
} as const;

export const radii = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  full: "9999px",
} as const;

export const shadows = {
  card: "var(--shadow-card)",
  soft: "var(--shadow-soft)",
  elegant: "var(--shadow-elegant)",
  glow: "var(--shadow-glow)",
} as const;

/** Standard component heights for touch targets and form controls. */
export const heights = {
  input: "var(--height-input)",
  inputSm: "var(--height-input-sm)",
  button: "var(--height-button)",
  buttonSm: "var(--height-button-sm)",
  buttonLg: "var(--height-button-lg)",
  row: "var(--height-row)",
} as const;

/** Max content widths for page layouts. */
export const layout = {
  pageNarrow: "var(--page-width-narrow)",
  pageDefault: "var(--page-width-default)",
  pageWide: "var(--page-width-wide)",
  pagePadding: "var(--page-padding-x)",
} as const;

export const DESIGN_TOKENS = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  heights,
  layout,
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
