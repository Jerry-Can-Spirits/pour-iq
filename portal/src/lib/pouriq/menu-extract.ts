import { EXTRACT_SYSTEM_PROMPT, EXTRACT_TOOL, type ExtractResult } from './import-prompts'

interface ExtractArgs {
  apiKey: string
  model?: string
  // Exactly one of these must be supplied.
  menuText?: string
  pdfBase64?: string
}

interface FinalUsage {
  prompt_tokens: number
  output_tokens: number
  model: string
}

export interface ExtractCallResult {
  result: ExtractResult
  usage: FinalUsage
  stopReason: string
}

type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

/**
 * Call Anthropic Claude Sonnet with tool-based structured output to extract
 * the drinks list. Source is either menu text or a base64-encoded PDF — the
 * model reads PDFs natively, so we don't run a Node-only PDF parser inside
 * the Workers runtime.
 */
export async function extractMenuWithAnthropic(args: ExtractArgs): Promise<ExtractCallResult> {
  const model = args.model ?? 'claude-sonnet-4-6'

  const userContent: UserContentBlock[] = []
  if (args.pdfBase64) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: args.pdfBase64 },
    })
    userContent.push({
      type: 'text',
      text: 'Extract every drink from this menu using the pouriq_extract_menu tool.',
    })
  } else if (args.menuText) {
    userContent.push({ type: 'text', text: args.menuText })
  } else {
    throw new Error('extractMenuWithAnthropic: provide either menuText or pdfBase64')
  }

  const body = {
    model,
    // Large UK bar menus can have 100+ drinks; each ~100 tokens in the
    // tool input. 4096 truncates mid-array and Anthropic returns an
    // empty drinks: [] tool input.
    max_tokens: 16384,
    system: [
      { type: 'text', text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'pouriq_extract_menu' },
    messages: [{ role: 'user', content: userContent }],
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Anthropic ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; name?: string; input?: unknown }>
    stop_reason?: string
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  const toolUse = data.content.find((c) => c.type === 'tool_use' && c.name === 'pouriq_extract_menu')
  if (!toolUse || !toolUse.input) {
    throw new Error('Anthropic did not return the extraction tool output')
  }

  return {
    result: toolUse.input as ExtractResult,
    usage: {
      prompt_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
      model,
    },
    stopReason: data.stop_reason ?? 'unknown',
  }
}
