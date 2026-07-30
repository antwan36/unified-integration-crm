import { buildPlaidClient } from './client'
import { loadPlaidCredentials } from '../secrets/plaid-credentials'
import {
  listPlaidItemsForSync,
  updatePlaidItemCursor,
  setPlaidItemStatus,
  upsertBankAccount,
  getBankAccountIdByPlaidAccountId,
  upsertBankTransaction,
  removeBankTransactionByPlaidId
} from '../db/plaid'
import type { Transaction } from 'plaid'
import type { PlaidSyncResult } from '../../shared/types'

async function syncOneItem(
  item: { id: string; institutionName: string; accessToken: string; cursor: string | null }
): Promise<{ added: number; modified: number }> {
  const creds = await loadPlaidCredentials()
  if (!creds) throw new Error('Plaid is not configured yet')
  const client = buildPlaidClient(creds)

  let cursor = item.cursor ?? undefined
  let hasMore = true
  let added = 0
  let modified = 0

  while (hasMore) {
    const response = await client.transactionsSync({
      access_token: item.accessToken,
      cursor
    })
    const { added: addedTx, modified: modifiedTx, removed, next_cursor, has_more } = response.data

    const upsert = async (tx: Transaction): Promise<void> => {
      const bankAccountId = await getBankAccountIdByPlaidAccountId(tx.account_id)
      if (!bankAccountId) return
      await upsertBankTransaction({
        bankAccountId,
        plaidTransactionId: tx.transaction_id,
        amountCents: Math.round(tx.amount * 100),
        date: tx.date,
        merchantName: tx.merchant_name ?? tx.name ?? null,
        plaidCategory: tx.personal_finance_category?.primary ?? null,
        pending: tx.pending
      })
    }

    for (const tx of addedTx) {
      await upsert(tx)
      added++
    }
    for (const tx of modifiedTx) {
      await upsert(tx)
      modified++
    }
    for (const removedTx of removed) {
      if (removedTx.transaction_id) await removeBankTransactionByPlaidId(removedTx.transaction_id)
    }

    cursor = next_cursor
    hasMore = has_more
  }

  if (cursor) await updatePlaidItemCursor(item.id, cursor)

  const accounts = await client.accountsGet({ access_token: item.accessToken })
  for (const account of accounts.data.accounts) {
    await upsertBankAccount({
      plaidItemId: item.id,
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

  return { added, modified }
}

export async function runPlaidSyncAll(): Promise<PlaidSyncResult> {
  try {
    const items = await listPlaidItemsForSync()
    let transactionsAdded = 0
    let transactionsModified = 0
    let itemsSynced = 0

    for (const item of items) {
      try {
        const { added, modified } = await syncOneItem(item)
        transactionsAdded += added
        transactionsModified += modified
        itemsSynced++
        await setPlaidItemStatus(item.id, 'active')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const reauthRequired = message.includes('ITEM_LOGIN_REQUIRED')
        await setPlaidItemStatus(item.id, reauthRequired ? 'reauth_required' : 'error')
        console.error(`Plaid sync failed for item ${item.institutionName}:`, message)
      }
    }

    return { ok: true, itemsSynced, transactionsAdded, transactionsModified }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      itemsSynced: 0,
      transactionsAdded: 0,
      transactionsModified: 0
    }
  }
}
