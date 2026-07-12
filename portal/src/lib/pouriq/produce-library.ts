export interface ProduceTemplate {
  name: string
  base_unit: 'each' | 'g'
  uses: { name: string; recipe_unit: 'ml' | 'count' | 'g'; yield_qty: number }[]
}
export const PRODUCE_LIBRARY: ProduceTemplate[] = [
  { name: 'Lemon', base_unit: 'each', uses: [ { name: 'Juice', recipe_unit: 'ml', yield_qty: 30 }, { name: 'Wheel', recipe_unit: 'count', yield_qty: 8 }, { name: 'Wedge', recipe_unit: 'count', yield_qty: 6 }, { name: 'Twist', recipe_unit: 'count', yield_qty: 4 } ] },
  { name: 'Lime', base_unit: 'each', uses: [ { name: 'Juice', recipe_unit: 'ml', yield_qty: 25 }, { name: 'Wheel', recipe_unit: 'count', yield_qty: 8 }, { name: 'Wedge', recipe_unit: 'count', yield_qty: 8 } ] },
  { name: 'Orange', base_unit: 'each', uses: [ { name: 'Juice', recipe_unit: 'ml', yield_qty: 70 }, { name: 'Wheel', recipe_unit: 'count', yield_qty: 6 }, { name: 'Twist', recipe_unit: 'count', yield_qty: 5 } ] },
  { name: 'Grapefruit', base_unit: 'each', uses: [ { name: 'Juice', recipe_unit: 'ml', yield_qty: 120 }, { name: 'Wheel', recipe_unit: 'count', yield_qty: 8 }, { name: 'Twist', recipe_unit: 'count', yield_qty: 6 } ] },
  { name: 'Mint', base_unit: 'each', uses: [ { name: 'Sprig', recipe_unit: 'count', yield_qty: 12 }, { name: 'Leaves', recipe_unit: 'count', yield_qty: 40 } ] },
  { name: 'Basil', base_unit: 'each', uses: [ { name: 'Sprig', recipe_unit: 'count', yield_qty: 8 }, { name: 'Leaves', recipe_unit: 'count', yield_qty: 30 } ] },
  { name: 'Cucumber', base_unit: 'each', uses: [ { name: 'Slice', recipe_unit: 'count', yield_qty: 20 }, { name: 'Ribbon', recipe_unit: 'count', yield_qty: 12 }, { name: 'Wedge', recipe_unit: 'count', yield_qty: 8 } ] },
  { name: 'Strawberry', base_unit: 'each', uses: [ { name: 'Slice', recipe_unit: 'count', yield_qty: 4 }, { name: 'Half', recipe_unit: 'count', yield_qty: 2 } ] },
  { name: 'Apple', base_unit: 'each', uses: [ { name: 'Slice', recipe_unit: 'count', yield_qty: 8 }, { name: 'Fan', recipe_unit: 'count', yield_qty: 4 } ] },
  { name: 'Pineapple', base_unit: 'each', uses: [ { name: 'Wedge', recipe_unit: 'count', yield_qty: 16 }, { name: 'Leaf', recipe_unit: 'count', yield_qty: 10 } ] },
]
