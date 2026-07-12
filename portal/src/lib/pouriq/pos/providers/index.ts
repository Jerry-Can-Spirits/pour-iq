import { createSquareAdapter, getSquareBaseUrl } from './square'
import { createZettleAdapter } from './zettle'
import { createSumUpAdapter } from './sumup'
import type { PosAdapter, PosProvider } from '../types'

/** Env slice the registry needs. All optional — adapters are unavailable (null) when their vars are missing. */
export interface ProvidersEnv {
  SQUARE_APP_ID?: string
  SQUARE_APP_SECRET?: string
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string
  SQUARE_ENV?: string
  ZETTLE_CLIENT_ID?: string
  ZETTLE_CLIENT_SECRET?: string
  SUMUP_CLIENT_ID?: string
  SUMUP_CLIENT_SECRET?: string
}

export function getAdapterForProvider(provider: PosProvider, env: ProvidersEnv): PosAdapter | null {
  switch (provider) {
    case 'square':
      if (!env.SQUARE_APP_ID || !env.SQUARE_APP_SECRET || !env.SQUARE_WEBHOOK_SIGNATURE_KEY) return null
      return createSquareAdapter({
        SQUARE_APP_ID: env.SQUARE_APP_ID,
        SQUARE_APP_SECRET: env.SQUARE_APP_SECRET,
        SQUARE_WEBHOOK_SIGNATURE_KEY: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
        SQUARE_ENV: env.SQUARE_ENV,
      })
    case 'zettle':
      if (!env.ZETTLE_CLIENT_ID || !env.ZETTLE_CLIENT_SECRET) return null
      return createZettleAdapter({
        ZETTLE_CLIENT_ID: env.ZETTLE_CLIENT_ID,
        ZETTLE_CLIENT_SECRET: env.ZETTLE_CLIENT_SECRET,
      })
    case 'sumup':
      if (!env.SUMUP_CLIENT_ID || !env.SUMUP_CLIENT_SECRET) return null
      return createSumUpAdapter({
        SUMUP_CLIENT_ID: env.SUMUP_CLIENT_ID,
        SUMUP_CLIENT_SECRET: env.SUMUP_CLIENT_SECRET,
      })
    default:
      return null
  }
}

/** Authorize URL for OAuth providers; null for api-key providers / unknown. */
export function getOAuthAuthorizeUrl(
  provider: PosProvider,
  env: ProvidersEnv,
  state: string,
  redirectUri: string,
): string | null {
  switch (provider) {
    case 'square': {
      if (!env.SQUARE_APP_ID) return null
      const params = new URLSearchParams({
        client_id: env.SQUARE_APP_ID,
        scope: 'ORDERS_READ ITEMS_READ MERCHANT_PROFILE_READ',
        session: 'false',
        state,
        redirect_uri: redirectUri,
      })
      return `${getSquareBaseUrl({ SQUARE_ENV: env.SQUARE_ENV })}/oauth2/authorize?${params.toString()}`
    }
    case 'zettle': {
      if (!env.ZETTLE_CLIENT_ID) return null
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.ZETTLE_CLIENT_ID,
        scope: 'READ:PURCHASE',
        state,
        redirect_uri: redirectUri,
      })
      return `https://oauth.zettle.com/authorize?${params.toString()}`
    }
    case 'sumup': {
      if (!env.SUMUP_CLIENT_ID) return null
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: env.SUMUP_CLIENT_ID,
        // transactions.history reads sales; user.profile_readonly lets the
        // /v0.1/me call resolve the merchant_code every transactions path needs.
        scope: 'transactions.history user.profile_readonly',
        state,
        redirect_uri: redirectUri,
      })
      return `https://api.sumup.com/authorize?${params.toString()}`
    }
    default:
      return null
  }
}
