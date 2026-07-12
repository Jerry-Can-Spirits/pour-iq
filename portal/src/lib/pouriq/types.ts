// Shared types for Pour IQ. Source of truth for everything from D1 row shapes
// to AI tool output. Keep this file small and import-only — no logic here.

export type LicenceType = 'pilot' | 'annual' | 'biannual' | 'monthly'

export const COST_CONFIDENCE = ['estimated', 'set', 'confirmed'] as const
export type CostConfidence = typeof COST_CONFIDENCE[number]

export type IngredientType =
  | 'spirit' | 'liqueur' | 'wine' | 'beer' | 'cider' | 'mixer'
  | 'syrup' | 'juice' | 'garnish' | 'soft-drink' | 'alcohol-free' | 'food' | 'other'

export const ALL_INGREDIENT_TYPES = [
  'spirit', 'liqueur', 'wine', 'beer', 'cider', 'mixer', 'syrup', 'juice',
  'garnish', 'soft-drink', 'alcohol-free', 'food', 'other',
] as const satisfies readonly IngredientType[]

export const ITEM_TYPES = ['cocktail', 'beer', 'cider', 'wine', 'spirit', 'soft-drink', 'food', 'other'] as const
export type ItemType = typeof ITEM_TYPES[number]

export type RecommendationSeverity = 'info' | 'warn' | 'action'
export type RecommendationCategory = 'pricing' | 'waste' | 'balance' | 'complexity' | 'opportunity'
export type RecommendationAction = 'adjust_price' | 'remove_cocktail' | 'remove_ingredient' | 'swap_ingredient'

export interface PourIqLicence {
  id: string
  trade_account_id: string
  licence_type: LicenceType
  valid_from: string
  valid_until: string
  price_paid_p: number
}

export type VolumeCadence = 'weekly' | 'monthly'
export type VolumeSource = 'manual' | 'pos'

export interface MenuSectionRow {
  id: string
  menu_id: string
  name: string
  parent_section_id: string | null
  position: number
  created_at: string
}

export interface MenuRow {
  id: string
  trade_account_id: string
  name: string
  venue_type: string | null
  city: string | null
  target_gp_pct: number
  positioning: string | null
  notes: string | null
  // 1 (default): sale prices include 20% UK VAT (customer-facing).
  // 0: sale prices are net of VAT (internal margin tracking).
  prices_include_vat: number
  volume_cadence: VolumeCadence
  // Exactly one menu per tenant has is_active = 1: the live menu POS sales
  // route to. Enforced in code (setActiveMenu clears siblings).
  is_active: number
  // Hidden per-tenant menu that holds serves; never shown in menu lists.
  is_serves_menu: number
  created_at: string
  updated_at: string
  theme: MenuTheme
  logo_r2_key: string | null
  logo_align: LogoAlign
}

export interface DrinkVolumeRow {
  id: string
  cocktail_id: string
  period_start: string  // ISO date YYYY-MM-DD
  period_end: string    // ISO date YYYY-MM-DD, inclusive
  units_sold: number
  source: VolumeSource
  created_at: string
  updated_at: string
}

export interface CocktailRow {
  id: string
  menu_id: string
  name: string
  sale_price_p: number
  promotional_price_p: number | null
  promotional_label: string | null
  // CSV of day numbers, 0=Sun .. 6=Sat. NULL = every day.
  promotional_days: string | null
  promotional_valid_from: string | null  // ISO YYYY-MM-DD
  promotional_valid_until: string | null
  position: number
  field_manual_slug: string | null
  notes: string | null
  description: string | null
  description_updated_at: string | null
  glass: string | null
  // 1 when this row is a "serve" (lives on the hidden serves menu).
  is_serve: number
  item_type: ItemType
  section_id: string | null
  photo_r2_key: string | null
  updated_at: string
}

export interface IngredientLibraryRow {
  id: string
  trade_account_id: string
  name: string
  ingredient_type: IngredientType
  base_unit: 'ml' | 'g' | 'each'
  pack_size: number
  price_p: number
  price_includes_vat: number
  price_entered_p: number | null
  pack_format: string | null
  subcategory: string | null
  is_prepared: number
  purchase_qty: number
  yield_pct: number
  barcode: string | null
  notes: string | null
  cost_confidence: CostConfidence
  created_at: string
  updated_at: string
  allergens: string
  dietary: string
  allergens_reviewed: number
  abv: number
}

export interface IngredientUseRow {
  id: string
  ingredient_id: string
  name: string
  recipe_unit: 'ml' | 'count' | 'g'
  yield_qty: number
  position: number
  created_at: string
}

export interface PreparedComponentRow {
  id: string
  prepared_ingredient_id: string
  component_ingredient_id: string
  amount_base: number
  recipe_unit: string | null
  recipe_qty: number | null
  created_at: string
}

export interface ServeUnitRow {
  id: string
  library_ingredient_id: string
  name: string
  base_per_unit: number
  created_at: string
}

export interface IngredientRow {
  id: string
  cocktail_id: string
  library_ingredient_id: string
  pour_ml: number | null
  unit_count: number | null
  recipe_unit: string | null
  recipe_qty: number | null
}

// IngredientRow with the library entry joined in — what calculations and
// rendering layers actually want to work with.
export interface IngredientWithLibrary extends IngredientRow {
  library: IngredientLibraryRow
  use_id: string | null
  use: IngredientUseRow | null
}

export interface CocktailWithIngredients extends CocktailRow {
  ingredients: IngredientWithLibrary[]
}

export interface CocktailMetrics {
  cocktail_id: string
  name: string
  sale_price_p: number
  // Net of VAT (sale_price_p ÷ 1.2 when the menu prices include VAT).
  // Exposed so menu-level blended GP can weight by net revenue.
  net_sale_p: number
  pour_cost_p: number
  margin_p: number
  gp_pct: number
  // False when any ingredient can't be priced (cost falls back to £0,
  // inflating GP). Drives the "cost incomplete" flag and headline exclusion.
  cost_complete: boolean
  // Populated only when the drink has a promotional price set. Same
  // pour_cost; margin and GP recomputed against the promotional price.
  promo?: {
    sale_price_p: number
    margin_p: number
    gp_pct: number
    label: string | null
    // Day-of-week numbers (0=Sun..6=Sat). null = applies every day.
    days: number[] | null
    valid_from: string | null
    valid_until: string | null
    // True iff the promo is in effect on the date the metrics were
    // computed (server "now"). Drives the UI's "Active today" badge.
    active_today: boolean
  }
  // Populated when a volume entry exists for the current period. The
  // contribution is margin_p × units_sold and is the real "drink
  // pulling its weight" number once volumes are tracked.
  volume?: {
    units_sold: number
    period_start: string
    period_end: string
    contribution_p: number
  }
}

export interface IngredientOverlap {
  ingredient_name: string
  cocktail_count: number
  cocktail_ids: string[]
}

export interface WasteRisk {
  ingredient_name: string
  cocktail_id: string
  cocktail_name: string
  reason: string
}

export interface MenuMetrics {
  // Unweighted mean GP% across costed drinks. Fallback headline when no
  // sales volumes exist yet.
  avg_gp_pct: number
  // Σ(margin × units) ÷ Σ(net sale × units) across costed drinks with
  // volume. Null when no costed drink has sold this period.
  blended_gp_pct: number | null
  // What the headline should show: blended when available, else average.
  headline_gp_pct: number
  headline_basis: 'blended' | 'average'
  // Drinks excluded from the headline because their cost data is incomplete.
  incomplete_cost_count: number
  best_margin: CocktailMetrics | null
  worst_margin: CocktailMetrics | null
  waste_risk_count: number
  cocktail_metrics: CocktailMetrics[]
  ingredient_overlap: IngredientOverlap[]
  waste_risks: WasteRisk[]
}

export interface FieldManualMatch {
  cocktail_id: string
  cocktail_name: string
  field_manual_url: string
}

export interface Recommendation {
  severity: RecommendationSeverity
  category: RecommendationCategory
  drink_id?: string
  title: string
  body: string
  suggested_change?: {
    action: RecommendationAction
    from?: string
    to?: string
    impact_summary: string
  }
  field_manual_reference?: {
    url: string
    why_relevant: string
  }
}

export const MENU_THEMES = ['heritage', 'premium', 'clean', 'casual', 'bold', 'classic'] as const
export type MenuTheme = typeof MENU_THEMES[number]
export type LogoAlign = 'left' | 'center' | 'right'

export const VARIANCE_REASONS = ['over-pour', 'spillage', 'comps', 'breakage', 'theft', 'unknown'] as const
export type VarianceReason = (typeof VARIANCE_REASONS)[number]

export interface StockCountEventRow {
  id: string
  trade_account_id: string
  library_ingredient_id: string
  counted_at: string
  count_qty: number
  reason: string | null
  created_at: string
}

export interface StockReceiptRow {
  id: string
  trade_account_id: string
  library_ingredient_id: string
  received_at: string
  qty: number
  source: 'invoice' | 'manual'
  invoice_line_id: string | null
  created_at: string
}
