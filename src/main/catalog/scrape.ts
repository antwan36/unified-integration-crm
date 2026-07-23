import * as cheerio from 'cheerio'
import type { ScrapedProduct } from '../../shared/types'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function parsePriceToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const str = Array.isArray(raw) ? raw[0] : raw
  const match = String(str)
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d{1,2})?)/)
  if (!match) return null
  return Math.round(parseFloat(match[1]) * 100)
}

interface JsonLdProduct {
  name?: string
  price?: unknown
  description?: string
}

function offerPrice(offers: unknown): unknown {
  if (!offers) return undefined
  const offer = Array.isArray(offers) ? offers[0] : offers
  return offer && typeof offer === 'object' ? (offer as Record<string, unknown>).price : offer
}

function hasType(type: unknown, name: string): boolean {
  return type === name || (Array.isArray(type) && type.includes(name))
}

function findJsonLdProduct(json: unknown): JsonLdProduct | null {
  const candidates: unknown[] = Array.isArray(json) ? json : [json]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const obj = candidate as Record<string, unknown>

    if (Array.isArray(obj['@graph'])) {
      const found = findJsonLdProduct(obj['@graph'])
      if (found) return found
    }

    const type = obj['@type']
    if (hasType(type, 'Product') || hasType(type, 'ProductGroup')) {
      let price = offerPrice(obj.offers)

      // ProductGroup (products with variants, e.g. colors) often has no top-level
      // offers — the price lives on the first variant instead.
      if (price === undefined && Array.isArray(obj.hasVariant) && obj.hasVariant.length > 0) {
        const variant = obj.hasVariant[0]
        if (variant && typeof variant === 'object') {
          price = offerPrice((variant as Record<string, unknown>).offers)
        }
      }

      let name = typeof obj.name === 'string' ? obj.name : undefined
      const brand = obj.brand
      const brandName =
        brand && typeof brand === 'object' ? (brand as Record<string, unknown>).name : undefined
      if (name && typeof brandName === 'string' && !name.toLowerCase().includes(brandName.toLowerCase())) {
        name = `${brandName} ${name}`
      }

      return {
        name,
        price,
        description: typeof obj.description === 'string' ? obj.description : undefined
      }
    }
  }
  return null
}

export async function scrapeProductUrl(url: string): Promise<ScrapedProduct> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('That link looks invalid.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https links are supported.')
  }

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('That site took too long to respond.')
    }
    throw new Error(`Could not reach that page (${err instanceof Error ? err.message : String(err)})`)
  }
  if (!res.ok) {
    if (res.status === 403 || res.status === 429 || res.headers.get('cf-mitigated')) {
      throw new Error('This site blocks automated access — try the manufacturer\'s page instead, or enter the details by hand.')
    }
    throw new Error(`Could not load that page (HTTP ${res.status})`)
  }
  const html = await res.text()
  const $ = cheerio.load(html)

  let name: string | null = null
  let priceCents: number | null = null
  let description: string | null = null

  $('script[type="application/ld+json"]').each((_, el) => {
    if (name && priceCents) return
    try {
      const json = JSON.parse($(el).contents().text())
      const product = findJsonLdProduct(json)
      if (product) {
        if (!name && product.name) name = product.name
        if (!priceCents && product.price !== undefined) {
          priceCents = parsePriceToCents(product.price)
        }
        if (!description && product.description) description = product.description
      }
    } catch {
      // Not valid/product JSON-LD — ignore and keep looking.
    }
  })

  if (!name) {
    name = $('meta[property="og:title"]').attr('content') || $('title').first().text().trim() || null
  }
  if (!priceCents) {
    const metaPrice =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[property="og:price:amount"]').attr('content') ||
      $('[itemprop="price"]').attr('content') ||
      $('[itemprop="price"]').first().text()
    priceCents = parsePriceToCents(metaPrice)
  }
  if (!description) {
    description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null
  }
  if (!priceCents) {
    const match = $('body').text().match(/\$\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/)
    if (match) priceCents = parsePriceToCents(match[1])
  }

  return {
    name: name ? name.trim().slice(0, 200) : null,
    description: description ? description.trim().slice(0, 500) : null,
    priceCents
  }
}
