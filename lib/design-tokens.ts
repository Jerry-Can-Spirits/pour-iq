// The single source of truth for the Pour IQ design language. Values
// arrive with the design pass — do NOT invent them here or hand-write
// colours/spacing in components. In a later task these tokens are
// bridged into CSS custom properties inside an @theme block in
// app/globals.css (Tailwind v4 is configured in CSS, not JS).

export interface TypeScaleStep {
  size: string
  lineHeight: string
}

export interface DesignTokens {
  colours: Record<string, string>
  typeScale: Record<string, TypeScaleStep>
  spacing: Record<string, string>
  radii: Record<string, string>
}

export const tokens: DesignTokens = {
  colours: {},
  typeScale: {},
  spacing: {},
  radii: {},
}
