import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { loadPlaidCredentials } from '../secrets/plaid-credentials'
import type { PlaidCredentials } from '../../shared/types'

export function buildPlaidClient(creds: PlaidCredentials): PlaidApi {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[creds.environment],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': creds.clientId,
        'PLAID-SECRET': creds.secret
      }
    }
  })
  return new PlaidApi(configuration)
}

export async function getPlaidClient(): Promise<PlaidApi> {
  const creds = await loadPlaidCredentials()
  if (!creds) throw new Error('Plaid is not configured yet')
  return buildPlaidClient(creds)
}
