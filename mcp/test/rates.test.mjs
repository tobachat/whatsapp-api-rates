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

test('unlisted ISO code prices as Other; an unknown name is an error, never Other', () => {
  assert.equal(resolveCountry('ZZ').market, 'Other')
  assert.throws(() => resolveCountry('Brasil'), InputError)
  assert.throws(() => getRate('NL', 'marketing', 'XYZ'), InputError)
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
