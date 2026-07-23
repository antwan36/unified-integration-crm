import { randomBytes } from 'crypto'
import { getSetting, setSetting } from '../db/settings'
import { getPortalUrl } from '../estimates/actions'

const TOKEN_KEY = 'calendar_feed_token'

async function getOrCreateToken(): Promise<string> {
  const existing = await getSetting(TOKEN_KEY)
  if (existing) return existing
  const token = randomBytes(24).toString('hex')
  await setSetting(TOKEN_KEY, token)
  return token
}

/**
 * The webcal:// link a client subscribes to once — Calendar apps re-fetch it on
 * their own schedule, so scheduled tasks created later show up automatically.
 */
export async function getCalendarFeedUrl(): Promise<string | null> {
  const portalUrl = await getPortalUrl()
  if (!portalUrl) return null
  const token = await getOrCreateToken()
  const host = portalUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `webcal://${host}/cal/${token}.ics`
}

export async function resetCalendarFeedToken(): Promise<void> {
  const token = randomBytes(24).toString('hex')
  await setSetting(TOKEN_KEY, token)
}
