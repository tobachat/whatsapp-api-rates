// Invariants: the bundle matches the repo files, every listed country resolves, the free allowance rule holds.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estimateCost, getRate, resolveCountry, rateChanges, InputError } from '../dist/rates.js'
import { data } from '../dist/data.generated.js'

const repo = new URL('../../', import.meta.url)
const csv = (p) => {
  const [head, ...rows] = readFileSync(new URL(p, repo), 'utf8').trim().split('\n').map((l) => l.split(','))
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

test('bundled rates equal data/latest for every currency, market and category', () => {
  const index = JSON.parse(readFileSync(new URL('rates.json', repo), 'utf8'))
  assert.equal(data.effective_date, index.latest_effective_date)
  for (const { code, latest } of index.currencies) {
    const rows = csv(latest)
    assert.equal(data.currencies[code].length, rows.length, code)
    for (const r of rows) {
      const m = data.currencies[code].find((x) => x.market === r.market)
      for (const c of ['marketing', 'utility', 'authentication', 'authentication_international', 'service']) {
        assert.equal(m[c], r[c] === '' ? null : Number(r[c]), `${code} ${r.market} ${c}`)
      }
    }
  }
})

test('every country in country_market.csv resolves to its market in every currency', () => {
  for (const r of csv('data/country_market.csv')) {
    assert.equal(resolveCountry(r.iso2).market, r.market)
    assert.equal(resolveCountry(r.country).market, r.market)
    for (const cur of Object.keys(data.currencies)) {
      assert.equal(typeof getRate(r.iso2, 'marketing', cur).rate, 'number', `${cur} ${r.iso2}`)
    }
  }
})

// Class guarded: an input that is not a real country silently priced at "Other" (UK came back as Other GBP 0.0435
// instead of United Kingdom GBP 0.0458). Real countries resolve by code or common name; anything else errors.
test('unknown codes and names are errors with close matches, never Other', () => {
  for (const bad of ['ZZ', 'QQ', 'Brasil', 'Atlantis']) assert.throws(() => resolveCountry(bad), InputError, bad)
  assert.throws(() => resolveCountry('ZZ'), /did you mean .*\(ZA\)/)
  assert.throws(() => resolveCountry('Brasil'), /did you mean Brazil \(BR\)/)
  assert.throws(() => resolveCountry('Congo'), /\(CD\).*\(CG\)/)
  assert.throws(() => getRate('NL', 'marketing', 'XYZ'), InputError)
})

test('aliases and common names resolve to the Meta market of that country', () => {
  const cases = {
    UK: 'United Kingdom', uk: 'United Kingdom', EL: 'Rest of Central & Eastern Europe', Holland: 'Netherlands',
    USA: 'North America', UAE: 'United Arab Emirates', 'Türkiye': 'Turkey', Turkiye: 'Turkey', Czechia: 'Rest of Central & Eastern Europe',
    CD: 'Other', CG: 'Rest of Africa',
  }
  for (const [input, market] of Object.entries(cases)) assert.equal(resolveCountry(input).market, market, input)
  assert.equal(getRate('UK', 'marketing', 'GBP').rate, getRate('GB', 'marketing', 'GBP').rate)
  assert.equal(resolveCountry('EL').country.iso2, 'GR')
})

test('real countries Meta does not list resolve by code and name to Other', () => {
  for (const [input, iso2] of [['XK', 'XK'], ['Kosovo', 'XK'], ['Iceland', 'IS'], ['IS', 'IS'], ['South Korea', 'KR']]) {
    const r = resolveCountry(input)
    assert.equal(r.market, 'Other', input)
    assert.equal(r.country.iso2, iso2, input)
  }
})

test('category is case-insensitive', () => {
  assert.equal(getRate('NL', 'Marketing').category, 'marketing')
  assert.equal(getRate('NL', 'Authentication International').category, 'authentication_international')
  assert.throws(() => getRate('NL', 'promo'), InputError)
})

test('free service allowance: per phone number, pooled over lines, service only', () => {
  const per = data.free_service.per_number_per_month
  const nl = getRate('NL', 'service', 'EUR').rate
  const e = estimateCost(
    [
      { country: 'NL', category: 'service', count: per - 200 },
      { country: 'DE', category: 'service', count: 500 },
      { country: 'NL', category: 'marketing', count: 10 },
    ],
    'EUR',
  )
  assert.deepEqual(e.lines.map((l) => l.free), [per - 200, 200, 0])
  assert.equal(e.lines[1].billable, 300)
  assert.equal(e.lines[2].cost, Math.round(10 * getRate('NL', 'marketing', 'EUR').rate * 1e6) / 1e6)
  assert.equal(estimateCost([{ country: 'NL', category: 'service', count: 2 * per }], 'EUR', 2).total, 0)
  assert.equal(estimateCost([{ country: 'NL', category: 'service', count: per + 1 }], 'EUR').total, nl)
})

test('rate_changes filters by date and starts with the first card', () => {
  assert.equal(rateChanges().rate_cards[0].effective_date, data.versions[0].effective_date)
  assert.equal(rateChanges('2999-01-01').rate_cards.length, 0)
  assert.throws(() => rateChanges('last week'), InputError)
})
