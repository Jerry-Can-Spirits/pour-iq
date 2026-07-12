'use client'

import { useState, useTransition } from 'react'
import { setVoiceProfileAction } from '@/lib/pouriq/server-actions'
import { PRIMARY_BUTTON } from '@/lib/pouriq/button-styles'
import type {
  VoiceLength,
  VoicePerson,
  VoiceProfile,
  VoiceTone,
} from '@/lib/pouriq/voice-profile'

interface Props {
  initial: VoiceProfile | null
}

const DEFAULT_RULES = [
  'No em-dashes',
  'No exclamation marks',
  'No emojis',
  'No superlatives without proof',
  'No hype words (epic, amazing, smash)',
  'No brand-as-verb (e.g. "Hennessy this")',
]

const TONE_OPTIONS: Array<{ value: VoiceTone; label: string }> = [
  { value: 'refined', label: 'Refined' },
  { value: 'casual', label: 'Casual' },
  { value: 'cheeky', label: 'Cheeky' },
  { value: 'classic', label: 'Classic' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'other', label: 'Other (describe below)' },
]

const PERSON_OPTIONS: Array<{ value: VoicePerson; label: string }> = [
  { value: 'we', label: '"We" (first-person plural)' },
  { value: 'i', label: '"I" (first-person singular)' },
  { value: 'you', label: '"You" (addressing the drinker)' },
  { value: 'third', label: 'Third-person ("the bar", "this drink")' },
]

const LENGTH_OPTIONS: Array<{ value: VoiceLength; label: string }> = [
  { value: 'short', label: 'Short (one sentence)' },
  { value: 'medium', label: 'Medium (two to three sentences)' },
  { value: 'long', label: 'Long (a short paragraph)' },
]

const fieldLabel = 'block text-xs uppercase tracking-widest text-slate-500 mb-1.5'
const inputClass = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden'
const textareaClass = `${inputClass} min-h-[100px]`
const selectClass = inputClass

export function VoiceProfileForm({ initial }: Props) {
  const [tone, setTone] = useState<VoiceTone>(initial?.tone ?? 'refined')
  const [toneOther, setToneOther] = useState<string>(initial?.tone_other ?? '')
  const [person, setPerson] = useState<VoicePerson>(initial?.person ?? 'we')
  const [length, setLength] = useState<VoiceLength>(initial?.length ?? 'medium')
  const [defaultRules, setDefaultRules] = useState<Set<string>>(
    new Set(initial ? initial.rules.filter((r) => DEFAULT_RULES.includes(r)) : DEFAULT_RULES),
  )
  const [customRulesText, setCustomRulesText] = useState<string>(
    initial ? initial.rules.filter((r) => !DEFAULT_RULES.includes(r)).join('\n') : '',
  )
  const [samples, setSamples] = useState<[string, string, string]>([
    initial?.samples[0] ?? '',
    initial?.samples[1] ?? '',
    initial?.samples[2] ?? '',
  ])
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleRule(rule: string) {
    setDefaultRules((s) => {
      const next = new Set(s)
      if (next.has(rule)) next.delete(rule)
      else next.add(rule)
      return next
    })
  }

  function updateSample(idx: 0 | 1 | 2, value: string) {
    setSamples((s) => {
      const next: [string, string, string] = [s[0], s[1], s[2]]
      next[idx] = value
      return next
    })
  }

  function submit() {
    setError(null)
    setInfo(null)
    const customRules = customRulesText
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
    const rules = [...defaultRules, ...customRules]
    startTransition(async () => {
      try {
        await setVoiceProfileAction({
          tone,
          tone_other: tone === 'other' ? toneOther : null,
          person,
          length,
          rules,
          samples: samples.filter((s) => s.trim().length > 0),
          notes,
        })
        setInfo('Voice Profile saved.')
      } catch (e) {
        setError((e as Error).message || 'Could not save Voice Profile')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="tone" className={fieldLabel}>Tone</label>
        <select id="tone" className={selectClass} value={tone} onChange={(e) => setTone(e.target.value as VoiceTone)}>
          {TONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {tone === 'other' && (
          <input
            type="text"
            value={toneOther}
            onChange={(e) => setToneOther(e.target.value)}
            placeholder="Describe the tone in a few words"
            className={`${inputClass} mt-2`}
            aria-label="Custom tone description"
          />
        )}
      </div>

      <div>
        <label htmlFor="person" className={fieldLabel}>Person</label>
        <select id="person" className={selectClass} value={person} onChange={(e) => setPerson(e.target.value as VoicePerson)}>
          {PERSON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="length" className={fieldLabel}>Length</label>
        <select id="length" className={selectClass} value={length} onChange={(e) => setLength(e.target.value as VoiceLength)}>
          {LENGTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <span className={fieldLabel}>Hard rules</span>
        <div className="grid sm:grid-cols-2 gap-2">
          {DEFAULT_RULES.map((rule) => (
            <label key={rule} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={defaultRules.has(rule)}
                onChange={() => toggleRule(rule)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span>{rule}</span>
            </label>
          ))}
        </div>
        <label htmlFor="custom-rules" className={`${fieldLabel} mt-3`}>Custom rules (one per line)</label>
        <textarea
          id="custom-rules"
          value={customRulesText}
          onChange={(e) => setCustomRulesText(e.target.value)}
          placeholder="e.g. Always mention the country of origin for spirits"
          className={textareaClass}
        />
      </div>

      <div>
        <span className={fieldLabel}>Sample descriptions (paste 1-3)</span>
        <p className="text-xs text-slate-500 mb-2">Concrete examples are the most powerful input. The AI will imitate the cadence, vocabulary, and rhythm. Yours, a competitor&apos;s, anything you like.</p>
        {[0, 1, 2].map((idx) => (
          <textarea
            key={idx}
            value={samples[idx]}
            onChange={(e) => updateSample(idx as 0 | 1 | 2, e.target.value)}
            placeholder={idx === 0 ? 'Sample 1 (required)' : `Sample ${idx + 1} (optional)`}
            className={`${textareaClass} mb-2`}
            aria-label={`Sample description ${idx + 1}`}
          />
        ))}
      </div>

      <div>
        <label htmlFor="notes" className={fieldLabel}>Anything else</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything specific to your brand — facts the AI should know, things it must never say, in-jokes, regional references."
          className={textareaClass}
        />
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {info && <p role="status" className="text-sm text-emerald-600">{info}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? 'Saving…' : 'Save Voice Profile'}
        </button>
      </div>
    </div>
  )
}
