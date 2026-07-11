// The single source of truth for the Pour IQ design language. No raw
// colour/spacing values may appear anywhere else — app/layout.tsx writes
// these tokens onto <html> as `--pour-*` CSS custom properties, and
// app/globals.css maps those properties into Tailwind's theme with
// `@theme inline` (Tailwind v4 is configured in CSS, not JS), so utilities
// like `bg-cellar` and `text-measure` resolve back to this object.

export interface TypeScaleStep {
  size: string
  lineHeight: string
  /** Size from the `lg` breakpoint (64rem) up. Omit for steps that do not scale. */
  desktopSize?: string
  letterSpacing?: string
}

export interface MotionTokens {
  easing: Record<string, string>
  duration: Record<string, string>
}

export interface DesignTokens {
  colours: Record<string, string>
  typeScale: Record<string, TypeScaleStep>
  spacing: Record<string, string>
  radii: Record<string, string>
  motion: MotionTokens
}

export const tokens: DesignTokens = {
  colours: {
    /** Page background. */
    cellar: '#0F1D18',
    /** Raised surfaces and hairline borders. */
    backbar: '#172A23',
    /** Primary text. */
    chalk: '#F2EFE6',
    /** Secondary text. 6.9:1 on cellar, 6.0:1 on backbar — AA at all sizes. */
    slate: '#9BA79E',
    /** Accent: CTAs, highlights, key figures. */
    measure: '#D98E2B',
    /** Negative figures only. 3.9:1 on cellar — restrict to large/bold text. */
    leak: '#C4554D',
    /** Positive figures only. */
    profit: '#7FB994',
  },
  typeScale: {
    'display-xl': { size: '2.5rem', lineHeight: '1.05', desktopSize: '4.5rem' },
    display: { size: '2rem', lineHeight: '1.1', desktopSize: '3rem' },
    heading: { size: '1.5rem', lineHeight: '1.2', desktopSize: '2rem' },
    body: { size: '1rem', lineHeight: '1.6', desktopSize: '1.125rem' },
    small: { size: '0.875rem', lineHeight: '1.5' },
    // Always set with the `uppercase` utility — text transform is not part
    // of a Tailwind font-size token.
    'mono-label': { size: '0.75rem', lineHeight: '1.4', letterSpacing: '0.08em' },
  },
  spacing: {
    /** 4px base scale — Tailwind's `--spacing` is re-pointed at this token. */
    unit: '0.25rem',
    'section-y': '4rem',
    'section-y-desktop': '7rem',
  },
  radii: {
    sm: '4px',
    md: '8px',
    lg: '16px',
  },
  motion: {
    easing: {
      pour: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
    duration: {
      fast: '200ms',
      base: '400ms',
      slow: '900ms',
    },
  },
}

/**
 * Flattens the token object into the `--pour-*` custom properties that
 * app/layout.tsx inlines on <html>. Every type-scale step emits a
 * `-desktop` size (falling back to the mobile size) so the breakpoint
 * switch in globals.css can reference each step uniformly.
 */
function toCssVariables(designTokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(designTokens.colours)) {
    vars[`--pour-colour-${name}`] = value
  }
  for (const [name, step] of Object.entries(designTokens.typeScale)) {
    vars[`--pour-text-${name}`] = step.size
    vars[`--pour-text-${name}-desktop`] = step.desktopSize ?? step.size
    vars[`--pour-text-${name}-leading`] = step.lineHeight
    if (step.letterSpacing) {
      vars[`--pour-text-${name}-tracking`] = step.letterSpacing
    }
  }
  for (const [name, value] of Object.entries(designTokens.spacing)) {
    vars[`--pour-spacing-${name}`] = value
  }
  for (const [name, value] of Object.entries(designTokens.radii)) {
    vars[`--pour-radius-${name}`] = value
  }
  for (const [name, value] of Object.entries(designTokens.motion.easing)) {
    vars[`--pour-ease-${name}`] = value
  }
  for (const [name, value] of Object.entries(designTokens.motion.duration)) {
    vars[`--pour-duration-${name}`] = value
  }
  return vars
}

export const tokenCssVariables = toCssVariables(tokens)
