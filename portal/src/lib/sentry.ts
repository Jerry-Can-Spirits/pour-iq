// Minimal stand-in for @/lib/sentry, matching the call sites ported from
// the Jerry Can Spirits repo. Real error tracking for the separated Pour IQ
// entity is a follow-up (its own Sentry project or Workers observability);
// until then failures still surface in worker logs.
export function captureException(error: unknown, context?: unknown): void {
  console.error('[sentry:exception]', error, context ?? '')
}

export function captureMessage(message: string, context?: unknown): void {
  console.warn('[sentry:message]', message, context ?? '')
}
