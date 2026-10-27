import test from 'node:test'
import assert from 'node:assert/strict'
import { getRate, listMarkets, estimateMonthlyCost } from '../dist/esm/index.js'

test('lookup by ISO code, name, region member and unknown country', () => {
  assert.equal(getRate('nl', 'marketing').market, 'Netherlands')
  assert.equal(getRate('Germany', 'utility').matched_by, 'country')
  assert.equal(getRate('BE', 'utility').market, 'Rest of Western Europe')
  assert.equal(getRate('ZZ', 'marketing').matched_by, 'other')
})

test('first 1000 service messages per number are free', () => {
  const r = getRate('NL', 'service').rate
  assert.equal(estimateMonthlyCost({ country: 'NL', service: 1000 }).total, 0)
  assert.equal(estimateMonthlyCost({ country: 'NL', service: 1500 }).total, Math.round(500 * r * 1e6) / 1e6)
  assert.equal(estimateMonthlyCost({ country: 'NL', service: 1500, phoneNumbers: 2 }).total, 0)
})

test('only service gets the allowance; totals add up', () => {
  const e = estimateMonthlyCost({ country: 'NL', marketing: 100, utility: 100 })
  const sum = e.lines.marketing.cost + e.lines.utility.cost
  assert.ok(Math.abs(e.total - sum) < 1e-9)
  assert.ok(e.total > 0)
})

test('bad input throws; markets listed', () => {
  assert.throws(() => estimateMonthlyCost({ country: 'NL', marketing: -1 }))
  assert.ok(listMarkets().length > 40)
})
