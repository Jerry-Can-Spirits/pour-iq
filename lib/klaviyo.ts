// Server-side Klaviyo forwarding for the demo-request form. Imported
// only from the contact server action — never from client code, so the
// private key stays out of every bundle (verified by grepping the build
// output for the key names).
//
// Two calls per submission: profile-import (create or update by email),
// then add the profile to the demo-requests list. Consent is recorded
// as a profile property with a timestamp; the caller has already
// enforced that consent was given (no forward happens without it).

const KLAVIYO_BASE = 'https://a.klaviyo.com/api'
const KLAVIYO_REVISION = '2024-10-15'

export type KlaviyoResult = 'ok' | 'unavailable' | 'error'

export interface DemoRequest {
  name: string
  venue: string
  email: string
  phone: string
  message: string
  consentedAt: string
}

interface KlaviyoEnv {
  KLAVIYO_API_KEY?: string
  KLAVIYO_DEMO_LIST_ID?: string
}

export async function forwardDemoRequest(
  env: KlaviyoEnv,
  request: DemoRequest,
): Promise<KlaviyoResult> {
  const apiKey = env.KLAVIYO_API_KEY
  const listId = env.KLAVIYO_DEMO_LIST_ID
  // Graceful 503 pattern (matches the portal's): with no key configured
  // the form reports temporarily unavailable rather than pretending.
  if (!apiKey || !listId) return 'unavailable'

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    revision: KLAVIYO_REVISION,
  }

  let importRes: Response
  try {
    importRes = await fetch(`${KLAVIYO_BASE}/profile-import/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email: request.email,
            first_name: request.name,
            properties: {
              venue_name: request.venue,
              // Free-text UK phone stays a property: Klaviyo's
              // phone_number attribute requires E.164 and rejects
              // anything else, which would fail real submissions.
              phone: request.phone || undefined,
              message: request.message || undefined,
              demo_consent: true,
              demo_consent_at: request.consentedAt,
            },
          },
        },
      }),
    })
  } catch {
    return 'error'
  }
  if (!importRes.ok) return 'error'

  const imported = (await importRes.json()) as { data?: { id?: string } }
  const profileId = imported.data?.id
  if (!profileId) return 'error'

  let listRes: Response
  try {
    listRes = await fetch(`${KLAVIYO_BASE}/lists/${listId}/relationships/profiles/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
    })
  } catch {
    return 'error'
  }
  // 204 on success; 409 means already in the list, which is fine.
  if (!listRes.ok && listRes.status !== 409) return 'error'
  return 'ok'
}
