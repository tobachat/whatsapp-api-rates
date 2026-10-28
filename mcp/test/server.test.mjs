// Invariants: every tool answer carries the data version and attribution (CC BY 4.0), bad input comes back as a
// tool error instead of a crash, the built binary speaks MCP over stdio, and the three version numbers agree.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createServer, VERSION } from '../dist/server.js'

const calls = {
  get_rate: { country: 'BR', category: 'marketing' },
  list_markets: {},
  estimate_cost: { messages: [{ country: 'IN', category: 'utility', count: 1000 }], currency: 'INR' },
  rate_changes: {},
}

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '0' })
  await Promise.all([createServer().connect(a), client.connect(b)])
  return client
}

test('every tool returns JSON with data version and attribution', async () => {
  const client = await connect()
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(calls).sort())
  for (const [name, args] of Object.entries(calls)) {
    const r = await client.callTool({ name, arguments: args })
    assert.ok(!r.isError, name)
    const body = JSON.parse(r.content[0].text)
    assert.match(body.data_version.effective_date, /^\d{4}-\d{2}-\d{2}$/, name)
    assert.match(body.attribution, /compiled by Tobachat/, name)
    assert.match(body.source, /^https:\/\/developers\.facebook\.com\//, name)
  }
  await client.close()
})

test('bad input is a tool error the model can read', async () => {
  const client = await connect()
  const r = await client.callTool({ name: 'get_rate', arguments: { country: 'Atlantis', category: 'marketing' } })
  assert.equal(r.isError, true)
  assert.match(r.content[0].text, /unknown country/)
  // The schema enum must not reject "Marketing" before the tool sees it.
  const ok = await client.callTool({ name: 'get_rate', arguments: { country: 'UK', category: 'Marketing', currency: 'GBP' } })
  assert.ok(!ok.isError, ok.content[0].text)
  assert.equal(JSON.parse(ok.content[0].text).market, 'United Kingdom')
  await client.close()
})

test('built binary answers over stdio', async () => {
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))] }),
  )
  const r = await client.callTool({ name: 'get_rate', arguments: { country: 'NL', category: 'utility', currency: 'EUR' } })
  assert.equal(JSON.parse(r.content[0].text).market, 'Netherlands')
  await client.close()
})

test('package.json, server.json and the server report the same version and name', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const reg = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, VERSION)
  assert.equal(reg.version, VERSION)
  assert.equal(reg.packages[0].version, VERSION)
  assert.equal(reg.packages[0].identifier, pkg.name)
  assert.equal(reg.name, pkg.mcpName)
  assert.ok(reg.description.length <= 100)
})
