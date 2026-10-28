// Pure lookups over the bundled dataset. No I/O: every answer comes from data.generated.ts.
import { data } from './data.generated.js'
import { CODE_ALIASES, ISO_COUNTRIES, NAME_ALIASES } from './iso.js'
import { CATEGORIES, type Category, type MarketRates } from './types.js'

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
  matched_by: 'iso_code' | 'country_name' | 'market_name'
  /** The country, also when Meta does not list it (then market is "Other" and calling_code null). */
  country: { iso2: string; name: string; calling_code: string | null } | null
}

/** Name key: lower case, no accents, "&" as "and", punctuation and a leading "the" dropped. */
const nameKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019.,()]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')

// Every name a country goes by (Meta's, ISO's, common aliases) to the ISO codes it can mean.
const byName = new Map<string, Set<string>>()
const addName = (name: string, iso2: string) => {
  const k = nameKey(name)
  byName.set(k, (byName.get(k) ?? new Set()).add(iso2))
}
for (const c of data.countries) addName(c.country, c.iso2)
for (const [iso2, name] of Object.entries(ISO_COUNTRIES)) addName(name, iso2)
for (const [alias, codes] of Object.entries(NAME_ALIASES)) for (const c of codes) addName(alias, c)

function fromIso(iso2: string, matched_by: Resolved['matched_by']): Resolved {
  const meta = data.countries.find((c) => c.iso2 === iso2)
  if (meta) return { market: meta.market, matched_by, country: { iso2, name: meta.country, calling_code: meta.calling_code } }
  return { market: 'Other', matched_by, country: { iso2, name: ISO_COUNTRIES[iso2], calling_code: null } }
}

const label = (iso2: string) => `${data.countries.find((c) => c.iso2 === iso2)?.country ?? ISO_COUNTRIES[iso2]} (${iso2})`

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[b.length]
}

/** Up to five known countries or markets close to the input, nearest first. */
function suggestions(input: string): string[] {
  const key = nameKey(input)
  const out: { s: string; d: number }[] = []
  if (/^[a-z]{2}$/i.test(input.trim())) {
    const code = input.trim().toUpperCase()
    for (const iso2 of Object.keys(ISO_COUNTRIES)) {
      // One letter off; same first letter ranks first (ZZ suggests ZA before AZ).
      if (distance(code, iso2) === 1) out.push({ s: label(iso2), d: iso2[0] === code[0] ? 0.5 : 1 })
    }
  }
  const limit = Math.max(2, Math.floor(key.length / 4))
  for (const [name, codes] of byName) {
    const d = name.startsWith(key) || key.startsWith(name) ? 1 : distance(key, name)
    if (d <= limit) for (const c of codes) out.push({ s: label(c), d })
  }
  // Single-country markets carry the country's name, already suggested above.
  for (const m of data.currencies[DEFAULT_CURRENCY].filter((x) => x.type !== 'country')) {
    const d = distance(key, nameKey(m.market))
    if (d <= limit) out.push({ s: `${m.market} (market)`, d })
  }
  return [...new Set(out.sort((a, b) => a.d - b.d).map((x) => x.s))].slice(0, 5)
}

function unknown(input: string, what: string): InputError {
  const near = suggestions(input)
  return new InputError(
    `unknown ${what} "${input}"; ${near.length ? `did you mean ${near.join(', ')}? ` : ''}` +
      'use an ISO 3166-1 alpha-2 code (for example "BR"), a country name, or call list_markets for the market names',
  )
}

/**
 * ISO 3166-1 alpha-2 code, country name (Meta's, ISO's or a common one such as "Holland") or rate-card market name.
 * A real country that Meta does not list is billed as "Other". Anything else is an error with close matches, so a
 * typo or an unknown code never silently prices as Other.
 */
export function resolveCountry(input: string): Resolved {
  const raw = (input ?? '').trim()
  if (!raw) throw new InputError('country is required (ISO code such as "BR", or a country or market name)')
  if (/^[a-z]{2}$/i.test(raw)) {
    const code = CODE_ALIASES[raw.toUpperCase()] ?? raw.toUpperCase()
    if (ISO_COUNTRIES[code]) return fromIso(code, 'iso_code')
    throw unknown(input, 'country code')
  }
  const codes = byName.get(nameKey(raw))
  if (codes?.size === 1) return fromIso([...codes][0], 'country_name')
  if (codes) {
    throw new InputError(
      `"${input}" can mean ${[...codes].map(label).join(' or ')}; use the ISO code to pick one`,
    )
  }
  const byMarket = data.currencies[DEFAULT_CURRENCY].find((m) => nameKey(m.market) === nameKey(raw))
  if (byMarket) return { market: byMarket.market, matched_by: 'market_name', country: null }
  throw unknown(input, 'country')
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
    country: r.country,
    market: r.market,
    matched_by: r.matched_by,
    category: c,
    currency: cur,
    rate,
    unit: 'per delivered message, excluding VAT (list rate; volume tiers for utility and authentication not applied)',
    ...(rate === null ? { note: `Meta publishes no ${c} rate for ${r.market}` } : {}),
    ...(r.market === 'Other' && r.country
      ? { market_note: `${r.country.name} is not on Meta's rate card, so it is billed at the Other rate` }
      : {}),
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
