import { SYSTEM_PROMPT, RECOMMEND_TOOL } from './prompts'
import type { Recommendation } from './types'

interface RecommendCallArgs {
  apiKey: string
  userMessage: string
  model?: string
  onRecommendation: (rec: Recommendation) => void
}

interface FinalUsage {
  prompt_tokens: number
  output_tokens: number
  model: string
}

export async function streamRecommendations(args: RecommendCallArgs): Promise<FinalUsage> {
  const model = args.model ?? 'claude-sonnet-4-6'

  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [RECOMMEND_TOOL],
    tool_choice: { type: 'tool', name: 'pouriq_recommendations' },
    messages: [{ role: 'user', content: args.userMessage }],
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Anthropic ${response.status}: ${errorText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let jsonAccumulator = ''
  let inRecommendationsArray = false
  let braceDepth = 0
  let currentObjectStart = -1
  let usage: FinalUsage = { prompt_tokens: 0, output_tokens: 0, model }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let eolIdx: number
    while ((eolIdx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, eolIdx)
      buffer = buffer.slice(eolIdx + 2)
      const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      const dataStr = dataLine.slice(6)
      if (dataStr === '[DONE]') continue
      let event: unknown
      try { event = JSON.parse(dataStr) } catch { continue }
      const ev = event as {
        type?: string
        delta?: { type?: string; partial_json?: string }
        usage?: { input_tokens?: number; output_tokens?: number }
        message?: { usage?: { input_tokens?: number; output_tokens?: number } }
      }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'input_json_delta') {
        const chunk = ev.delta.partial_json ?? ''
        jsonAccumulator += chunk
        for (let i = jsonAccumulator.length - chunk.length; i < jsonAccumulator.length; i++) {
          const ch = jsonAccumulator[i]
          if (!inRecommendationsArray) {
            if (ch === '[' && jsonAccumulator.slice(0, i).match(/"recommendations"\s*:\s*$/)) {
              inRecommendationsArray = true
              continue
            }
            continue
          }
          if (ch === '{') {
            if (braceDepth === 0) currentObjectStart = i
            braceDepth++
          } else if (ch === '}') {
            braceDepth--
            if (braceDepth === 0 && currentObjectStart !== -1) {
              const slice = jsonAccumulator.slice(currentObjectStart, i + 1)
              try {
                const obj = JSON.parse(slice) as Recommendation
                args.onRecommendation(obj)
              } catch { /* unreachable for balanced object */ }
              currentObjectStart = -1
            }
          } else if (ch === ']' && braceDepth === 0) {
            inRecommendationsArray = false
          }
        }
      } else if (ev.type === 'message_delta' && ev.usage) {
        usage = {
          prompt_tokens: ev.usage.input_tokens ?? usage.prompt_tokens,
          output_tokens: ev.usage.output_tokens ?? usage.output_tokens,
          model,
        }
      } else if (ev.type === 'message_start' && ev.message?.usage) {
        usage = {
          prompt_tokens: ev.message.usage.input_tokens ?? 0,
          output_tokens: ev.message.usage.output_tokens ?? 0,
          model,
        }
      }
    }
  }

  return usage
}
