import {
  EXTRACT_INVOICE_SYSTEM_PROMPT,
  EXTRACT_INVOICE_TOOL,
  type ExtractInvoiceResult,
} from './invoice-prompts'

interface ExtractArgs {
  apiKey: string
  model?: string
  pdfBase64: string
}

interface FinalUsage {
  prompt_tokens: number
  output_tokens: number
  model: string
}

export interface ExtractInvoiceCallResult {
  result: ExtractInvoiceResult
  usage: FinalUsage
  stopReason: string
}

type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

export async function extractInvoiceWithAnthropic(args: ExtractArgs): Promise<ExtractInvoiceCallResult> {
  const model = args.model ?? 'claude-sonnet-4-6'

  const userContent: UserContentBlock[] = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: args.pdfBase64 },
    },
    {
      type: 'text',
      text: 'Extract every billable product line from this invoice using the pouriq_extract_invoice tool.',
    },
  ]

  const body = {
    model,
    max_tokens: 16384,
    system: [
      { type: 'text', text: EXTRACT_INVOICE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [EXTRACT_INVOICE_TOOL],
    tool_choice: { type: 'tool', name: 'pouriq_extract_invoice' },
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

  const toolUse = data.content.find((c) => c.type === 'tool_use' && c.name === 'pouriq_extract_invoice')
  if (!toolUse || !toolUse.input) {
    throw new Error('Anthropic did not return the extraction tool output')
  }

  return {
    result: toolUse.input as ExtractInvoiceResult,
    usage: {
      prompt_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
      model,
    },
    stopReason: data.stop_reason ?? 'unknown',
  }
}
