/**
 * PixelVault Faucet + API Server
 * 
 * Standalone Express server that runs on the Contabo VPS alongside the Initia node.
 * Provides:
 *   POST /api/faucet    – Send ERC-20 game tokens to a TBA
 *   POST /api/fund-gas  – Send native GAS to a new EVM address
 *   POST /api/advisor   – AI/rule-based trading advisor
 *
 * Env vars:
 *   PRIVATE_KEY         – Deployer private key (0x-prefixed)
 *   EVM_RPC_URL         – Local EVM RPC (default: http://127.0.0.1:8545)
 *   PXL_TOKEN_ADDRESS   – PXLToken contract address
 *   DNGN_TOKEN_ADDRESS  – DungeonDropsToken contract address
 *   HRV_TOKEN_ADDRESS   – HarvestFieldToken contract address
 *   RACE_TOKEN_ADDRESS  – CosmicRacerToken contract address
 *   GROK_API_KEY        – (optional) Grok AI API key for advisor
 *   PORT                – Server port (default: 3001)
 */

const express = require('express')
const cors = require('cors')
const {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  encodeFunctionData,
  getAddress,
} = require('viem')
const { privateKeyToAccount } = require('viem/accounts')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const RPC_URL = process.env.EVM_RPC_URL || 'http://127.0.0.1:8545'

// Read addresses from deployed-addresses.json (auto-synced by deploy script)
const fs = require('fs')
const path = require('path')
let deployedAddresses = {}
try {
  const addrPath = path.join(__dirname, 'src', 'lib', 'deployed-addresses.json')
  deployedAddresses = JSON.parse(fs.readFileSync(addrPath, 'utf8'))
  console.log('Loaded token addresses from deployed-addresses.json')
} catch (e) {
  console.warn('Could not read deployed-addresses.json, falling back to env vars')
}

function safeAddr(raw) {
  if (!raw) return null
  try { return getAddress(raw.trim()) } catch { return null }
}

// Prefer file-based addresses, env vars as fallback
const PXL_TOKEN = safeAddr(deployedAddresses.PXLToken || process.env.PXL_TOKEN_ADDRESS)
const DNGN_TOKEN = safeAddr(deployedAddresses.DungeonDropsToken || process.env.DNGN_TOKEN_ADDRESS)
const HRV_TOKEN = safeAddr(deployedAddresses.HarvestFieldToken || process.env.HRV_TOKEN_ADDRESS)
const RACE_TOKEN = safeAddr(deployedAddresses.CosmicRacerToken || process.env.RACE_TOKEN_ADDRESS)

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

// Cache chain config
let chainConfig = null
async function getChainConfig() {
  if (chainConfig) return chainConfig
  const transport = http(RPC_URL)
  const pub = createPublicClient({ transport })
  const chainId = await pub.getChainId()
  chainConfig = {
    id: chainId,
    name: 'minievm',
    nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  }
  return chainConfig
}

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pixelvault-api' })
})

// ── Fund Gas ──
app.post('/api/fund-gas', async (req, res) => {
  const rawAddress = req.body?.address
  if (!rawAddress || !rawAddress.startsWith('0x') || rawAddress.trim().length !== 42) {
    return res.status(400).json({ error: 'Send { "address": "0x..." }' })
  }

  let address
  try {
    address = getAddress(rawAddress.trim())
  } catch {
    return res.status(400).json({ error: 'Invalid address checksum' })
  }

  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    return res.status(500).json({ error: 'No deployer key configured' })
  }

  try {
    const transport = http(RPC_URL)
    const account = privateKeyToAccount(pk)
    const pub = createPublicClient({ transport })
    const chain = await getChainConfig()
    const client = createWalletClient({ account, transport })

    const hash = await client.sendTransaction({
      to: address,
      value: parseEther('0.1'),
      chain,
      account,
    })
    const receipt = await pub.waitForTransactionReceipt({ hash })
    if (receipt.status === 'reverted') {
      throw new Error(`Fund-gas reverted (tx: ${hash})`)
    }

    return res.json({ ok: true, funded: address, hash })
  } catch (err) {
    console.error('Fund-gas error:', err)
    return res.status(500).json({ error: err?.message || 'Transfer failed' })
  }
})

// ── Faucet ──
app.post('/api/faucet', async (req, res) => {
  const rawTba = req.body?.tba
  if (!rawTba || !rawTba.startsWith('0x') || rawTba.trim().length !== 42) {
    return res.status(400).json({ error: 'Send { "tba": "0x..." }' })
  }

  let tba
  try {
    tba = getAddress(rawTba.trim())
  } catch {
    return res.status(400).json({ error: 'Invalid TBA address checksum' })
  }

  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    return res.status(500).json({ error: 'No deployer key configured' })
  }

  if (!PXL_TOKEN || !DNGN_TOKEN || !HRV_TOKEN || !RACE_TOKEN) {
    return res.status(500).json({ error: 'Token addresses not configured' })
  }

  try {
    const transport = http(RPC_URL)
    const account = privateKeyToAccount(pk)
    const pub = createPublicClient({ transport })
    const chain = await getChainConfig()
    const client = createWalletClient({ account, transport })

    let nonce = await pub.getTransactionCount({ address: account.address })

    const sendTx = (token, amount) => {
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [tba, amount],
      })
      const currentNonce = nonce++
      return client.sendTransaction({
        to: token,
        data,
        chain,
        account,
        nonce: currentNonce,
      })
    }

    // Send all 4 transactions without waiting (sequential nonces go into same/next block)
    const hashes = await Promise.all([
      sendTx(PXL_TOKEN, parseEther('10000')),
      sendTx(DNGN_TOKEN, parseEther('500')),
      sendTx(HRV_TOKEN, parseEther('500')),
      sendTx(RACE_TOKEN, parseEther('500')),
    ])

    // Wait for all receipts in parallel (all likely in same block)
    const receipts = await Promise.all(
      hashes.map(hash => pub.waitForTransactionReceipt({ hash }))
    )
    for (const receipt of receipts) {
      if (receipt.status === 'reverted') {
        throw new Error(`Transfer reverted (tx: ${receipt.transactionHash})`)
      }
    }

    return res.json({ ok: true, funded: tba })
  } catch (err) {
    console.error('Faucet error:', err)
    return res.status(500).json({ error: err?.message || 'Faucet transfer failed' })
  }
})

// ── Advisor ──
app.post('/api/advisor', async (req, res) => {
  const { inventory, balances, floorPrices, listings, ratings, dexPrices } = req.body
  if (!inventory || !balances) {
    return res.status(400).json({ error: 'Missing portfolio data' })
  }

  const apiKey = process.env.GROK_API_KEY

  const prompt = `You are a DeFi trading advisor for PixelVault, a blockchain gaming economy.
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.

PLAYER STATE:
Balances: PXL=${balances.PXL}, DNGN=${balances.DNGN}, HRV=${balances.HRV}
Inventory: ${JSON.stringify(inventory)}

DEX PRICES (PXL per 1 game token):
DNGN = ${dexPrices?.dngnPricePxl || '0.1'} PXL each
HRV = ${dexPrices?.hrvPricePxl || '0.1'} PXL each

ITEM FLOOR PRICES:
${JSON.stringify(floorPrices)}

LIVE MARKETPLACE LISTINGS:
${listings?.length > 0 ? JSON.stringify(listings) : 'No active listings'}

GAME RATINGS: ${JSON.stringify(ratings)}

TASK: Give exactly 3 trading recommendations. Each must reference specific numbers and calculate expected gain.
{"recommendations":[{"action":"sell|buy|swap|stake|skip","text":"SPECIFIC ADVICE WITH NUMBERS","impact":"positive|negative|neutral"}]}`

  if (apiKey) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 25000)
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'grok-3-mini',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (response.ok) {
        const data = await response.json()
        const text = data.choices?.[0]?.message?.content?.trim()
        if (text) {
          const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          try {
            return res.json(JSON.parse(clean))
          } catch {}
        }
      }
    } catch {}
  }

  // Fallback: rule-based advice
  const result = calculateAdvice(inventory, balances, floorPrices, listings, dexPrices, ratings)
  return res.json(result)
})

function calculateAdvice(inventory, balances, floorPrices, listings, dexPrices, ratings) {
  const recs = []

  const pxl = parseFloat(balances?.PXL || '0')
  const dngn = parseFloat(balances?.DNGN || '0')
  const hrv = parseFloat(balances?.HRV || '0')
  const dngnPrice = parseFloat(dexPrices?.dngnPricePxl || '0.1')
  const hrvPrice = parseFloat(dexPrices?.hrvPricePxl || '0.1')

  const swords = parseInt(inventory?.['Common Sword'] || '0')
  const shields = parseInt(inventory?.['Rare Shield'] || '0')
  const crowns = parseInt(inventory?.['Legendary Crown'] || '0')
  const harvestItems = parseInt(inventory?.['Seasonal Harvest Item'] || '0')

  const swordFloor = parseFloat(floorPrices?.['Common Sword'] || '1.66')
  const shieldFloor = parseFloat(floorPrices?.['Rare Shield'] || '3.32')
  const crownFloor = parseFloat(floorPrices?.['Legendary Crown'] || '9.96')

  const listingMap = {}
  if (Array.isArray(listings)) {
    for (const l of listings) {
      const price = parseFloat(l.pricePerItemPxl || l.price || '0')
      if (!listingMap[l.item] || price < listingMap[l.item]) {
        listingMap[l.item] = price
      }
    }
  }

  // Recommendation 1: Best sell opportunity
  if (swords > 0 || shields > 0 || crowns > 0) {
    const bestItem = crowns > 0 ? 'Legendary Crown' : shields > 0 ? 'Rare Shield' : 'Common Sword'
    const floor = crowns > 0 ? crownFloor : shields > 0 ? shieldFloor : swordFloor
    const target = (floor * 1.5).toFixed(2)
    recs.push({ action: 'sell', text: `List your ${bestItem} at ${target} PXL — 50% above the ${floor.toFixed(2)} PXL floor to maximize profit`, impact: 'positive' })
  }

  // Recommendation 2: DEX strategy
  if (dngn > 100 && dngnPrice > 0) {
    const pxlFromDngn = (dngn * dngnPrice).toFixed(2)
    recs.push({ action: 'swap', text: `Swap your ${dngn.toFixed(0)} DNGN to ~${pxlFromDngn} PXL on the DEX (rate: ${dngnPrice.toFixed(4)} PXL/DNGN)`, impact: 'positive' })
  } else if (pxl > 200) {
    const dngnYouGet = (100 / dngnPrice).toFixed(0)
    recs.push({ action: 'swap', text: `Swap 100 PXL to ~${dngnYouGet} DNGN — enough for ${Math.floor(parseFloat(dngnYouGet) / 10)} dungeon runs`, impact: 'positive' })
  }

  // Recommendation 3
  if (harvestItems > 0) {
    recs.push({ action: 'sell', text: `List your ${harvestItems} Seasonal Harvest Item(s) — production cost is near-zero, so any PXL is pure profit`, impact: 'positive' })
  } else {
    recs.push({ action: 'stake', text: `Stake HRV in HarvestField for 100 blocks to earn a Seasonal Harvest Item for free`, impact: 'positive' })
  }

  return { recommendations: recs.slice(0, 3) }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PixelVault API server running on port ${PORT}`)
  console.log(`  EVM RPC: ${RPC_URL}`)
  console.log(`  PXL Token: ${PXL_TOKEN}`)
  console.log(`  DNGN Token: ${DNGN_TOKEN}`)
  console.log(`  HRV Token: ${HRV_TOKEN}`)
})
