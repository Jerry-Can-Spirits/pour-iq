import type { MatchRowState } from '@/components/pouriq/IngredientMatchRow'
import { normalise } from '@/lib/pouriq/match'
import type { IngredientType } from '@/lib/pouriq/types'

export function groupKeyFor(input: { extracted_name: string; base_product?: string | null; inferred_type: IngredientType; match: { kind: string; catalogue_id?: string } }): string | null {
  const base = input.base_product && input.base_product.trim() ? input.base_product : null
  // Measure-less spirit lines stay ungrouped (today's behaviour); once a
  // base_product is present the line is a serve of a known product and can group.
  if (input.inferred_type === 'spirit' && !base) return null
  const m = input.match
  // Group by the serve-stripped product name when we have it, else the line's
  // own name. Name-based (not catalogue_id) keeps distinct products that share
  // one generic entry separate; the serve-strip is what lets multi-serve lines
  // of the SAME product share a key.
  if (m.kind === 'catalogue' || m.kind === 'suggestions' || m.kind === 'no-match') {
    return `name:${normalise(base ?? input.extracted_name)}`
  }
  return null
}

export interface BulkFillRow {
  // null = auto-matched / ungrouped: never a source or a target of fill.
  groupKey: string | null
  resolved: boolean
  state: MatchRowState
}

// Given all preview ingredient rows and the index of the one just resolved,
// return the indices of OTHER still-unresolved rows in the same group plus the
// resolution to copy (ingredient identity only — never the per-drink pour/unit).
// Null when there is nothing to fill.
export function planBulkFill(rows: BulkFillRow[], sourceIndex: number): {
  targets: number[]
  apply: Pick<MatchRowState, 'existing_library_id' | 'new_library'>
} | null {
  const source = rows[sourceIndex]
  if (!source || !source.resolved || source.groupKey === null) return null
  const targets: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i === sourceIndex) continue
    const r = rows[i]
    if (r.groupKey === source.groupKey && !r.resolved) targets.push(i)
  }
  if (targets.length === 0) return null
  return {
    targets,
    apply: {
      existing_library_id: source.state.existing_library_id,
      new_library: source.state.new_library,
    },
  }
}
