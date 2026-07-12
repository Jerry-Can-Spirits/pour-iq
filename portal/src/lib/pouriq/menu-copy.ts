// Brand-voiced menu copy: prompt assembly + Anthropic call.
// Pure prompt assembly is testable; the HTTP call is a thin wrapper.

import type { VoiceProfile } from './voice-profile'

export interface CocktailForCopy {
  name: string
  sale_price_p: number | null
  abv: number | null
  ingredients: Array<{ name: string; pour_ml: number | null; unit_count: number | null }>
}

const PERSON_DESCRIPTIONS: Record<VoiceProfile['person'], string> = {
  we: "first-person plural: 'we'",
  i: "first-person singular: 'I'",
  you: "second-person addressed to the drinker: 'you'",
  third: "third-person: 'the bar', 'this drink', no narrator pronoun",
}

const LENGTH_DESCRIPTIONS: Record<VoiceProfile['length'], string> = {
  short: 'short — one sentence, ideally under 20 words',
  medium: 'medium — two to three sentences',
  long: 'long — one short paragraph (4-6 sentences)',
}

const TONE_DESCRIPTIONS: Record<Exclude<VoiceProfile['tone'], 'other'>, string> = {
  refined: 'refined and measured; understated confidence',
  casual: 'casual and conversational; relaxed pub voice',
  cheeky: 'cheeky and playful; light irreverence, no smugness',
  classic: 'classic cocktail-bar voice; timeless, evocative',
  minimal: 'minimal and direct; nouns and verbs, no flourish',
}

function toneDescription(profile: VoiceProfile): string {
  if (profile.tone === 'other' && profile.tone_other) {
    return profile.tone_other
  }
  if (profile.tone === 'other') {
    return 'as the bar describes (see notes below)'
  }
  return TONE_DESCRIPTIONS[profile.tone]
}

/**
 * Assemble the system prompt that constrains the model's voice and rules.
 * Pure — no IO. Easy to inspect.
 */
export function assemblePromptSystem(profile: VoiceProfile): string {
  const parts: string[] = []
  parts.push('You write drink descriptions for a bar. Match this voice exactly.')
  parts.push('')
  parts.push(`Tone: ${toneDescription(profile)}`)
  parts.push(`Person: ${PERSON_DESCRIPTIONS[profile.person]}`)
  parts.push(`Length: ${LENGTH_DESCRIPTIONS[profile.length]}`)
  parts.push('')
  if (profile.rules.length > 0) {
    parts.push('Hard rules — never break these:')
    for (const r of profile.rules) parts.push(`- ${r}`)
    parts.push('')
  }
  if (profile.samples.length > 0) {
    parts.push("Examples of writing in this voice. Imitate the cadence, vocabulary, and rhythm:")
    profile.samples.forEach((s, idx) => parts.push(`${idx + 1}. ${s.trim()}`))
    parts.push('')
  }
  if (profile.notes.trim()) {
    parts.push('Other notes about this bar:')
    parts.push(profile.notes.trim())
    parts.push('')
  }
  parts.push('Output rules:')
  parts.push('- Output ONLY the description text. No preamble, no quote marks, no "Here is..."')
  parts.push('- Do not invent ingredients not listed.')
  parts.push('- Do not state ABV unless asked.')
  return parts.join('\n')
}

function formatIngredient(i: CocktailForCopy['ingredients'][number]): string {
  if (i.pour_ml !== null && i.pour_ml > 0) return `${i.pour_ml}ml ${i.name}`
  if (i.unit_count !== null && i.unit_count > 0) {
    return i.unit_count === 1 ? `1 × ${i.name}` : `${i.unit_count} × ${i.name}`
  }
  return `splash of ${i.name}`
}

/**
 * Assemble the per-drink user message. Pure.
 */
export function assemblePromptUser(cocktail: CocktailForCopy): string {
  const parts: string[] = []
  parts.push(`Drink name: ${cocktail.name}`)
  if (cocktail.ingredients.length === 0) {
    parts.push('Ingredients: (none recorded)')
  } else {
    parts.push('Ingredients:')
    for (const i of cocktail.ingredients) parts.push(`- ${formatIngredient(i)}`)
  }
  if (cocktail.sale_price_p !== null && cocktail.sale_price_p > 0) {
    parts.push(`Price: £${(cocktail.sale_price_p / 100).toFixed(2)}`)
  }
  if (cocktail.abv !== null) {
    parts.push(`ABV: ${cocktail.abv}%`)
  }
  parts.push('')
  parts.push('Write the description.')
  return parts.join('\n')
}

/**
 * Strip leading/trailing whitespace and surrounding quote marks. Soft-checks
 * the output against any "no X" hard rules and logs to console (server-side)
 * for diagnostic value — does NOT reject the output.
 */
export function sanitiseGeneratedText(raw: string, rules: string[]): string {
  let out = raw.trim()
  // Strip a single pair of wrapping quotes if the entire output is wrapped.
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith("'") && out.endsWith("'"))
  ) {
    out = out.slice(1, -1).trim()
  }
  const lower = out.toLowerCase()
  for (const rule of rules) {
    const r = rule.toLowerCase()
    if (r.includes('no em-dash') && out.includes('—')) {
      console.warn('menu-copy: em-dash in output despite rule', { rule })
    }
    if (r.includes('no exclamation') && out.includes('!')) {
      console.warn('menu-copy: exclamation in output despite rule', { rule })
    }
    if (r.includes('no emoji') && /\p{Emoji}/u.test(out)) {
      console.warn('menu-copy: emoji in output despite rule', { rule })
    }
    if (r.includes('no hype') && /(epic|amazing|incredible|game[- ]changer|smash)/i.test(lower)) {
      console.warn('menu-copy: hype word in output despite rule', { rule })
    }
  }
  return out
}

export interface GenerateArgs {
  apiKey: string
  model?: string
  profile: VoiceProfile
  cocktail: CocktailForCopy
}

export async function generateDescriptionWithAnthropic(args: GenerateArgs): Promise<string> {
  const model = args.model ?? 'claude-sonnet-4-6'
  const system = assemblePromptSystem(args.profile)
  const user = assemblePromptUser(args.cocktail)

  const body = {
    model,
    max_tokens: 400,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
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
    content: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content.find((c) => c.type === 'text' && typeof c.text === 'string')
  if (!textBlock || !textBlock.text) {
    throw new Error('Anthropic did not return a text content block')
  }
  return sanitiseGeneratedText(textBlock.text, args.profile.rules)
}
