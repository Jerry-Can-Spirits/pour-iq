// POST /api/pouriq/recommend?menuId=X
// Streams AI recommendations as SSE events. Each event payload is one
// Recommendation object (JSON). Persists the analysis row to D1 on stream end.
//
// Edge runtime — fetch streaming end-to-end without Node deps.

import { NextResponse } from 'next/server'
import * as Sentry from '@/lib/sentry'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isAllowedOrigin, isRateLimited } from '@/lib/kv'
import { checkPourIqAccess } from '@/lib/pouriq/access'
import { getMenu, listCocktailsForMenu, insertAnalysis } from '@/lib/pouriq/menus'
import { calculateMenuMetrics } from '@/lib/pouriq/calculations'
import { currentPeriod, listVolumesForPeriod } from '@/lib/pouriq/volumes'
import { buildUserMessage } from '@/lib/pouriq/prompts'
import { streamRecommendations } from '@/lib/pouriq/anthropic'
import { fieldManualUrl } from '@/lib/pouriq/field-manual-match'
import type { Recommendation, FieldManualMatch } from '@/lib/pouriq/types'

export const runtime = 'nodejs'

const RECOMMEND_RATE_LIMIT = 60

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await checkPourIqAccess()
  if (access.kind !== 'ok') return new Response('Unauthorized', { status: 401 })

  const url = new URL(request.url)
  const menuId = url.searchParams.get('menuId')
  if (!menuId) return new Response('menuId required', { status: 400 })

  const { env } = await getCloudflareContext()
  const kv = env.SITE_OPS as KVNamespace
  const db = env.DB as D1Database

  if (!env.ANTHROPIC_API_KEY) {
    Sentry.captureMessage('pouriq-recommend: ANTHROPIC_API_KEY missing', { tags: { route: 'pouriq-recommend', phase: 'config' } })
    return NextResponse.json({ error: 'AI recommendations are temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  if (await isRateLimited(kv, 'pouriq-recommend', access.tradeAccountId, RECOMMEND_RATE_LIMIT, 3600)) {
    return NextResponse.json({ error: 'Too many recommendation requests. Please try again later.' }, { status: 429 })
  }

  const menu = await getMenu(db, menuId, access.tradeAccountId)
  if (!menu) return new Response('Not found', { status: 404 })

  const cocktails = await listCocktailsForMenu(db, menuId)
  const period = currentPeriod(menu.volume_cadence)
  const volumes = await listVolumesForPeriod(db, menuId, period.start, period.end)
  const metrics = calculateMenuMetrics(cocktails, menu.prices_include_vat === 1, volumes)
  const fieldManualMatches: FieldManualMatch[] = cocktails
    .filter((c) => c.field_manual_slug)
    .map((c) => ({
      cocktail_id: c.id,
      cocktail_name: c.name,
      field_manual_url: fieldManualUrl(c.field_manual_slug!),
    }))
  const userMessage = buildUserMessage(menu, metrics, fieldManualMatches)

  const encoder = new TextEncoder()
  const collected: Recommendation[] = []

  const stream = new ReadableStream({
    async start(controller) {
      function emit(rec: Recommendation) {
        collected.push(rec)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(rec)}\n\n`))
      }

      try {
        const usage = await streamRecommendations({
          apiKey: env.ANTHROPIC_API_KEY,
          userMessage,
          onRecommendation: emit,
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        await insertAnalysis(db, {
          menu_id: menuId,
          model: usage.model,
          prompt_tokens: usage.prompt_tokens,
          output_tokens: usage.output_tokens,
          recommendations_json: JSON.stringify(collected),
          metrics_json: JSON.stringify(metrics),
        })
      } catch (err) {
        Sentry.captureException(err, { tags: { route: 'pouriq-recommend' } })
        const message = (err as Error).message || 'Stream failed'
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
