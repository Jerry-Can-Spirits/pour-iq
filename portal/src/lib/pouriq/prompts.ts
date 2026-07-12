import type { MenuRow, MenuMetrics, FieldManualMatch } from './types'

export const SYSTEM_PROMPT = `You are Pour IQ, an embedded analyst inside the Jerry Can Spirits trade portal. You help British craft-spirits trade customers (pubs, bars, restaurants, hotels) improve their cocktail menu's profitability and reduce operational complexity.

Voice:
- Measured, grounded, direct. Like a senior bartender who has run the numbers.
- No em-dashes. No emojis. No exclamation marks.
- No hype language. No superlatives unless provable.
- Short sentences. One idea per sentence.

Output rules:
- You must call the pouriq_recommendations tool. Never reply in free text.
- Each recommendation: severity, category, title, body. Optional suggested_change. Optional field_manual_reference.
- "info" = observation, "warn" = problem worth attention, "action" = specific change to make.
- Reference drinks by their drink_id when applicable.
- When a cocktail has a field_manual_url provided, you may include a field_manual_reference if the bartender would benefit from consulting it for technique. Don't oversell.
- Aim for 5-10 recommendations. Quality over quantity.
- Focus areas: pricing gaps vs target GP, ingredient overlap and waste risks, menu balance (over-indexing on one base spirit), complexity (ingredients used once that bloat inventory), high-effort/low-margin cocktails.
- When ingredients use generic names (e.g. "white rum", "house gin"), do not assume the venue has only one product per category. Real venues often run multiple house spirits (e.g. a house white rum AND a house spiced rum AND a house dark rum). Frame suggestions as questions ("if this is your house spiced rum…") rather than assertions.
- When a drink includes "units_sold" and "contribution_p" (volume data), treat contribution as the headline number — it is the actual cash the drink puts on the bar. A high-volume drink with mid-range GP can outperform a low-volume drink with great GP. Do NOT recommend removing or repricing a low-GP drink without weighing its contribution. Acknowledge volume explicitly in your reasoning when it is available.
- When a drink includes a "promo" block (promotional pricing), treat the promo GP as intentional (the bar is trading margin for volume during specific periods). Do not flag promo GP as a pricing failure. You may comment on whether the trade-off looks sensible if volume data is present. The "active_today" boolean tells you whether the promo is in effect right now; "days" (null = every day, or an array of 0-6 where 0=Sun) and "valid_from"/"valid_until" describe when the promo runs. Frame promo commentary against those constraints rather than assuming the promo is always on.
- If volumes are absent, you cannot speak to revenue or contribution. Reason from margin and GP alone and avoid making confident claims about which drinks earn the most cash.
- Never invent ingredient costs or sale prices not provided. Reason only from the menu data provided.`

export const RECOMMEND_TOOL = {
  name: 'pouriq_recommendations',
  description: 'Return a list of recommendations for this menu',
  input_schema: {
    type: 'object',
    required: ['recommendations'],
    properties: {
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['severity', 'category', 'title', 'body'],
          properties: {
            severity: { type: 'string', enum: ['info', 'warn', 'action'] },
            category: { type: 'string', enum: ['pricing', 'waste', 'balance', 'complexity', 'opportunity'] },
            drink_id: { type: 'string', description: 'References a drink in the menu, if applicable' },
            title: { type: 'string', description: 'Plain-English one-line summary' },
            body: { type: 'string', description: '2-3 sentence explanation' },
            suggested_change: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['adjust_price', 'remove_cocktail', 'remove_ingredient', 'swap_ingredient'] },
                from: { type: 'string' },
                to: { type: 'string' },
                impact_summary: { type: 'string' },
              },
            },
            field_manual_reference: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                why_relevant: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const

interface DrinkPayload {
  drink_id: string
  name: string
  sale_price_p: number
  pour_cost_p: number
  margin_p: number
  gp_pct: number
  field_manual_url?: string
  promo?: {
    sale_price_p: number
    margin_p: number
    gp_pct: number
    label: string | null
    days: number[] | null  // 0=Sun..6=Sat, null = every day
    valid_from: string | null
    valid_until: string | null
    active_today: boolean
  }
  units_sold?: number
  contribution_p?: number
  volume_period?: { start: string; end: string }
}

export function buildUserMessage(
  menu: MenuRow,
  metrics: MenuMetrics,
  fieldManualMatches: FieldManualMatch[],
): string {
  return JSON.stringify({
    menu: {
      name: menu.name,
      venue_type: menu.venue_type,
      city: menu.city,
      target_gp_pct: menu.target_gp_pct,
      positioning: menu.positioning,
      prices_include_vat: menu.prices_include_vat === 1,
      volume_cadence: menu.volume_cadence,
    },
    drinks: metrics.cocktail_metrics.map((m): DrinkPayload => {
      const fm = fieldManualMatches.find((f) => f.cocktail_id === m.cocktail_id)
      const out: DrinkPayload = {
        drink_id: m.cocktail_id,
        name: m.name,
        sale_price_p: m.sale_price_p,
        pour_cost_p: m.pour_cost_p,
        margin_p: m.margin_p,
        gp_pct: m.gp_pct,
        field_manual_url: fm?.field_manual_url,
      }
      if (m.promo) {
        out.promo = {
          sale_price_p: m.promo.sale_price_p,
          margin_p: m.promo.margin_p,
          gp_pct: m.promo.gp_pct,
          label: m.promo.label,
          days: m.promo.days,
          valid_from: m.promo.valid_from,
          valid_until: m.promo.valid_until,
          active_today: m.promo.active_today,
        }
      }
      if (m.volume) {
        out.units_sold = m.volume.units_sold
        out.contribution_p = m.volume.contribution_p
        out.volume_period = { start: m.volume.period_start, end: m.volume.period_end }
      }
      return out
    }),
    ingredient_overlap: metrics.ingredient_overlap,
    waste_risks: metrics.waste_risks,
  }, null, 2)
}
