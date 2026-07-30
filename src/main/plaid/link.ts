import { CountryCode, Products } from 'plaid'
import { getPlaidClient } from './client'
import { createPlaidItem, upsertBankAccount } from '../db/plaid'
import type { PlaidExchangeResult, PlaidLinkTokenResult } from '../../shared/types'

export async function createLinkToken(): Promise<PlaidLinkTokenResult> {
  try {
    const client = await getPlaidClient()
    const response = await client.linkTokenCreate({
      client_name: 'Unified Integration CRM',
      language: 'en',
      country_codes: [CountryCode.Us],
      user: { client_user_id: 'unified-integration-crm' },
      products: [Products.Transactions]
    })
    return { ok: true, linkToken: response.data.link_token }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function exchangePublicToken(
  publicToken: string,
  institutionName: string
): Promise<PlaidExchangeResult> {
  try {
    const client = await getPlaidClient()
    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken })
    const { access_token: accessToken, item_id: plaidItemId } = exchange.data

    const itemId = await createPlaidItem(plaidItemId, institutionName, accessToken)

    const accounts = await client.accountsGet({ access_token: accessToken })
    for (const account of accounts.data.accounts) {
      await upsertBankAccount({
        plaidItemId: itemId,
        plaidAccountId: account.account_id,
        name: account.name,
        mask: account.mask ?? null,
        type: account.type ?? null,
        subtype: account.subtype ?? null,
        currentBalanceCents:
          account.balances.current != null ? Math.round(account.balances.current * 100) : null,
        availableBalanceCents:
          account.balances.available != null ? Math.round(account.balances.available * 100) : null
      })
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
