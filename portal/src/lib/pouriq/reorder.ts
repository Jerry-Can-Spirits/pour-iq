export function insertAt(ids: string[], movedId: string, index: number): string[] {
  const without = ids.filter((id) => id !== movedId)
  const clamped = Math.max(0, Math.min(index, without.length))
  return [...without.slice(0, clamped), movedId, ...without.slice(clamped)]
}
