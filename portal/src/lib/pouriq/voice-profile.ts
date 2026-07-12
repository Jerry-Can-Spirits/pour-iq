// Voice Profile data access. Tenant scoping is enforced by callers
// (server action verifies access before touching this module).

import 'server-only'

export type VoiceTone = 'refined' | 'casual' | 'cheeky' | 'classic' | 'minimal' | 'other'
export type VoicePerson = 'we' | 'i' | 'you' | 'third'
export type VoiceLength = 'short' | 'medium' | 'long'

export interface VoiceProfile {
  trade_account_id: string
  tone: VoiceTone
  tone_other: string | null
  person: VoicePerson
  length: VoiceLength
  rules: string[]
  samples: string[]
  notes: string
  updated_at: string
}

export interface VoiceProfileInput {
  tone: VoiceTone
  tone_other: string | null
  person: VoicePerson
  length: VoiceLength
  rules: string[]
  samples: string[]
  notes: string
}

interface VoiceProfileRow {
  trade_account_id: string
  tone: string
  tone_other: string | null
  person: string
  length: string
  rules_json: string
  samples_json: string
  notes: string
  updated_at: string
}

function parseStringArray(raw: string, field: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string')
  } catch {
    // Persisted JSON should always be valid; if it isn't, fall back to empty
    // rather than throw — the user can re-save the profile to repair it.
    console.warn(`voice-profile: invalid JSON in ${field}`)
    return []
  }
}

function isVoiceTone(s: string): s is VoiceTone {
  return s === 'refined' || s === 'casual' || s === 'cheeky' || s === 'classic' || s === 'minimal' || s === 'other'
}

function isVoicePerson(s: string): s is VoicePerson {
  return s === 'we' || s === 'i' || s === 'you' || s === 'third'
}

function isVoiceLength(s: string): s is VoiceLength {
  return s === 'short' || s === 'medium' || s === 'long'
}

export async function getVoiceProfile(
  db: D1Database,
  tradeAccountId: string,
): Promise<VoiceProfile | null> {
  const row = await db
    .prepare(`
      SELECT trade_account_id, tone, tone_other, person, length,
             rules_json, samples_json, notes, updated_at
      FROM pouriq_voice_profiles
      WHERE trade_account_id = ?1
    `)
    .bind(tradeAccountId)
    .first<VoiceProfileRow>()
  if (!row) return null
  if (!isVoiceTone(row.tone) || !isVoicePerson(row.person) || !isVoiceLength(row.length)) {
    // Defensive: if the DB ever contains an unknown enum value, treat as missing
    // and let the manager re-create the profile.
    return null
  }
  return {
    trade_account_id: row.trade_account_id,
    tone: row.tone,
    tone_other: row.tone_other,
    person: row.person,
    length: row.length,
    rules: parseStringArray(row.rules_json, 'rules_json'),
    samples: parseStringArray(row.samples_json, 'samples_json'),
    notes: row.notes,
    updated_at: row.updated_at,
  }
}

export async function upsertVoiceProfile(
  db: D1Database,
  tradeAccountId: string,
  input: VoiceProfileInput,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO pouriq_voice_profiles
        (trade_account_id, tone, tone_other, person, length, rules_json, samples_json, notes, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))
      ON CONFLICT(trade_account_id) DO UPDATE SET
        tone = excluded.tone,
        tone_other = excluded.tone_other,
        person = excluded.person,
        length = excluded.length,
        rules_json = excluded.rules_json,
        samples_json = excluded.samples_json,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `)
    .bind(
      tradeAccountId,
      input.tone,
      input.tone_other,
      input.person,
      input.length,
      JSON.stringify(input.rules),
      JSON.stringify(input.samples),
      input.notes,
    )
    .run()
}
