// Pure lookups over the bundled dataset. No I/O: every answer comes from data.generated.ts.
import { data } from './data.generated.js'
import { CATEGORIES, type Category, type Country, type MarketRates } from './types.js'

export const DEFAULT_CURRENCY = 'USD'

/** A problem with the caller's input; the server turns it into a tool error the model can read and correct. */
export class InputError extends Error {}

/** Version and attribution that go with every answer (CC BY 4.0 asks for the attribution). */
export function about() {
  return {
    data_version: { effective_date: data.effective_date, checked_on: data.checked_on },
    source: data.source,
    attribution: data.attribution,
    license: data.license,
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export function currencyOf(currency?: string): string {
  const c = (currency ?? DEFAULT_CURRENCY).trim().toUpperCase()
  if (!data.currencies[c]) {
    throw new InputError(`unknown currency ${c}; Meta publishes: ${Object.keys(data.currencies).join(', ')}`)
  }
  return c
}

export interface Resolved {
  market: string
  matched_by: 'iso_code' | 'country_name' | 'market_name' | 'other'
  country: Country | null
}

/**
 * ISO 3166-1 alpha-2 code, country name (as Meta writes it) or rate-card market name. A valid-looking ISO code
 * that Meta does not list is billed as "Other"; an unknown name is an error, so a typo never silently prices as Other.
 */
export function resolveCountry(input: string): Resolved {
  const key = norm(input ?? '')
  if (!key) throw new InputError('country is required (ISO code such as "BR", or a country or market name)')
  const byIso = data.countries.find((c) => c.iso2.toLowerCase() === key)
  if (byIso) return { market: byIso.market, matched_by: 'iso_code', country: byIso }
  const byName = data.countries.find((c) => norm(c.country) === key)
  if (byName) return { market: byName.market, matched_by: 'country_name', country: byName }
  const markets = data.currencies[DEFAULT_CURRENCY]
  const byMarket = markets.find((m) => norm(m.market) === key)
  if (byMarket) return { market: byMarket.market, matched_by: 'market_name', country: null }
  if (/^[a-z]{2}$/.test(key)) return { market: 'Other', matched_by: 'other', country: null }
  throw new InputError(
    `unknown country "${input}"; use an ISO 3166-1 alpha-2 code (for example "BR") or call list_markets for the names`,
  )
}

function category(c: string): Category {
  const k = norm(c).replace(/[ -]/g, '_') as Category
  if (!CATEGORIES.includes(k)) throw new InputError(`unknown category "${c}"; use one of: ${CATEGORIES.join(', ')}`)
  return k
}

function marketRates(currency: string, market: string): MarketRates {
  const m = data.currencies[currency].find((x) => x.market === market)
  if (!m) throw new Error(`market ${market} missing in ${currency}`)
  return m
}

export function getRate(country: string, cat: string, currency?: string) {
  const cur = currencyOf(currency)
  const r = resolveCountry(country)
  const c = category(cat)
  const rate = marketRates(cur, r.market)[c]
  return {
    country: r.country ? { iso2: r.country.iso2, name: r.country.country, calling_code: r.country.calling_code } : null,
    market: r.market,
    matched_by: r.matched_by,
    category: c,
    currency: cur,
    rate,
    unit: 'per delivered message, excluding VAT (list rate; volume tiers for utility and authentication not applied)',
    ...(rate === null ? { note: `Meta publishes no ${c} rate for ${r.market}` } : {}),
    ...about(),
  }
}

export function listMarkets() {
  const markets = data.currencies[DEFAULT_CURRENCY].map((m) => ({
    market: m.market,
    type: m.type,
    countries: data.countries
      .filter((c) => c.market === m.market)
      .map((c) => ({ iso2: c.iso2, name: c.country, calling_code: c.calling_code })),
  }))
  return {
    markets,
    other: 'Every country not listed under a market is billed at the "Other" rate.',
    currencies: Object.keys(data.currencies),
    categories: CATEGORIES,
    ...about(),
  }
}

export interface MessageLine {
  country: string
  category: string
  count: number
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Cost at list rates for one calendar month. The free service allowance (per business phone number per month,
 * pooled over all countries) is applied to the service lines in the order given.
 */
export function estimateCost(messages: MessageLine[], currency?: string, phoneNumbers = 1) {
  const cur = currencyOf(currency)
  if (!Array.isArray(messages) || messages.length === 0) throw new InputError('messages must be a non-empty list')
  if (!Number.isInteger(phoneNumbers) || phoneNumbers < 1) throw new InputError('phone_numbers must be an integer >= 1')
  const fs = data.free_service
  const allowance = data.effective_date >= fs.since ? fs.per_number_per_month * phoneNumbers : 0
  let freeLeft = allowance
  let total = 0
  const lines = messages.map((m, i) => {
    if (!Number.isInteger(m.count) || m.count < 0) throw new InputError(`messages[${i}].count must be an integer >= 0`)
    const r = resolveCountry(m.country)
    const c = category(m.category)
    const rate = marketRates(cur, r.market)[c]
    if (rate === null) throw new InputError(`messages[${i}]: Meta publishes no ${c} rate for ${r.market}`)
    const free = c === 'service' ? Math.min(freeLeft, m.count) : 0
    freeLeft -= free
    const cost = round((m.count - free) * rate)
    total += cost
    return { country: m.country, market: r.market, category: c, count: m.count, free, billable: m.count - free, rate, cost }
  })
  return {
    currency: cur,
    lines,
    total: round(total),
    free_service_allowance: allowance,
    assumptions: [
      'List rates per delivered message, excluding VAT, for one calendar month.',
      `First ${fs.per_number_per_month} service messages per business phone number per month are free (since ${fs.since}), pooled over countries, applied in the order given.`,
      'Volume-tier discounts for utility and authentication are not applied, so this is the most you pay at list rates.',
    ],
    ...about(),
  }
}

export function rateChanges(since?: string, currency?: string) {
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new InputError('since must be a date YYYY-MM-DD')
  const cur = currency === undefined ? null : currencyOf(currency)
  const cards = data.versions
    .filter((v) => since === undefined || v.effective_date > since)
    .map((v) => ({
      effective_date: v.effective_date,
      previous_card: v.previous,
      notes: v.notes,
      changes:
        v.changes === null
          ? null
          : v.changes.filter((c) => c.currency === (cur ?? DEFAULT_CURRENCY)).map(({ currency: _c, ...rest }) => rest),
      ...(v.changes === null ? { changes_note: 'First card in this dataset; no rate-level diff with an earlier card.' } : {}),
    }))
  return {
    currency: cur ?? DEFAULT_CURRENCY,
    rate_cards: cards,
    earlier_quarters_without_data: data.earlier_quarters.filter((q) => since === undefined || q.effective_date > since),
    schedule: 'Meta changes rates only on 1 January, 1 April, 1 July and 1 October.',
    ...about(),
  }
}
