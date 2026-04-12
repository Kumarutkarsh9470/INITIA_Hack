import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { inventory, balances, floorPrices, listings, ratings, dexPrices } = req.body
  if (!inventory || !balances) return res.status(400).json({ error: 'Missing portfolio data' })

  const apiKey = process.env.GROK_API_KEY

  // Build a rich prompt with actual numbers so the AI gives specific advice
  const prompt = `You are a DeFi trading advisor for PixelVault, a blockchain gaming economy.
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.

PLAYER STATE:
Balances: PXL=${balances.PXL}, DNGN=${balances.DNGN}, HRV=${balances.HRV}
Inventory: ${JSON.stringify(inventory)}

DEX PRICES (PXL per 1 game token):
DNGN = ${dexPrices?.dngnPricePxl || '0.1'} PXL each
HRV = ${dexPrices?.hrvPricePxl || '0.1'} PXL each

ITEM FLOOR PRICES (minimum rational value in PXL based on production cost × game rating):
${JSON.stringify(floorPrices)}

LIVE MARKETPLACE LISTINGS (what sellers are currently asking):
${listings?.length > 0 ? JSON.stringify(listings) : 'No active listings'}

GAME RATINGS: ${JSON.stringify(ratings)}

TASK: Give exactly 3 trading recommendations. Each must:
1. Reference specific numbers from the data above
2. Calculate the expected gain or saving in PXL
3. Be one sentence starting with an action word

Example of good advice:
"Sell your Common Sword now — listing at 60 PXL while floor is 1.66 PXL, list yours at 55 PXL for a quick sale and convert proceeds to DNGN for 550 dungeon runs"
"Buy the Rare Shield listed at 3.32 PXL — it is exactly at floor value, resell if price rises"
"Swap 100 DNGN to PXL at current rate of 0.1 PXL/DNGN = 10 PXL, then add liquidity to earn 0.3% fees"

{"recommendations":[{"action":"sell|buy|swap|stake|skip","text":"SPECIFIC ADVICE WITH NUMBERS","impact":"positive|negative|neutral"}]}`

  // Try AI first, fall back to rule-based
  if (apiKey) {
    const aiResult = await tryGrok(apiKey, prompt)
    if (aiResult) return res.status(200).json(aiResult)
  }

  // Fallback: pure arithmetic recommendations — specific, calculated, not generic
  const result = calculateAdvice(inventory, balances, floorPrices, listings, dexPrices, ratings)
  return res.status(200).json(result)
}

async function tryGrok(apiKey: string, prompt: string) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 25000)
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'grok-3-mini', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!response.ok) { console.error('Grok error:', response.status); return null }
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return null
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch (e: any) {
    console.error('Grok failed:', e?.message)
    return null
  }
}

function calculateAdvice(inventory: any, balances: any, floorPrices: any, listings: any[], dexPrices: any, ratings: any) {
  const recs: { action: string; text: string; impact: string }[] = []

  const pxl = parseFloat(balances?.PXL || '0')
  const dngn = parseFloat(balances?.DNGN || '0')
  const hrv = parseFloat(balances?.HRV || '0')
  const dngnPrice = parseFloat(dexPrices?.dngnPricePxl || '0.1')
  const hrvPrice = parseFloat(dexPrices?.hrvPricePxl || '0.1')

  // Parse inventory counts
  const swords = parseInt(inventory?.['Common Sword'] || '0')
  const shields = parseInt(inventory?.['Rare Shield'] || '0')
  const crowns = parseInt(inventory?.['Legendary Crown'] || '0')
  const harvestItems = parseInt(inventory?.['Seasonal Harvest Item'] || '0')

  // Parse floor prices
  const swordFloor = parseFloat(floorPrices?.['Common Sword'] || '1.66')
  const shieldFloor = parseFloat(floorPrices?.['Rare Shield'] || '3.32')
  const crownFloor = parseFloat(floorPrices?.['Legendary Crown'] || '9.96')

  // Find cheapest listing per item type
  const listingMap: Record<string, number> = {}
  if (Array.isArray(listings)) {
    for (const l of listings) {
      const price = parseFloat(l.pricePerItemPxl || l.price || '0')
      if (!listingMap[l.item] || price < listingMap[l.item]) {
        listingMap[l.item] = price
      }
    }
  }

  const swordListing = listingMap['Common Sword']
  const shieldListing = listingMap['Rare Shield']
  const crownListing = listingMap['Legendary Crown']

  // ── Recommendation 1: Best sell opportunity ──────────────────────────
  let bestSellRec = ''
  let bestSellMultiple = 0

  if (swords > 0 && swordListing) {
    const multiple = swordListing / swordFloor
    if (multiple > bestSellMultiple) {
      bestSellMultiple = multiple
      const suggestedPrice = (swordListing * 0.92).toFixed(2)
      const dngnFromProceeds = (parseFloat(suggestedPrice) / dngnPrice).toFixed(0)
      bestSellRec = `Sell your Common Sword at ${suggestedPrice} PXL (8% below the listing at ${swordListing.toFixed(2)} PXL for a quick sale) — swap the proceeds to ~${dngnFromProceeds} DNGN for ${Math.floor(parseFloat(dngnFromProceeds) / 10)} more dungeon runs`
    }
  }
  if (shields > 0 && shieldListing) {
    const multiple = shieldListing / shieldFloor
    if (multiple > bestSellMultiple) {
      bestSellMultiple = multiple
      const suggestedPrice = (shieldListing * 0.92).toFixed(2)
      const netAfterFee = (parseFloat(suggestedPrice) * 0.975).toFixed(2)
      bestSellRec = `Sell your Rare Shield at ${suggestedPrice} PXL (undercutting the ${shieldListing.toFixed(2)} PXL listing) — you net ${netAfterFee} PXL after 2.5% fee, ${((parseFloat(netAfterFee) / shieldFloor) * 100 - 100).toFixed(0)}% above floor`
    }
  }
  if (crowns > 0 && crownListing) {
    const multiple = crownListing / crownFloor
    if (multiple > bestSellMultiple) {
      bestSellMultiple = multiple
      const suggestedPrice = (crownListing * 0.92).toFixed(2)
      bestSellRec = `Sell your Legendary Crown at ${suggestedPrice} PXL — the listing is at ${crownListing.toFixed(2)} PXL, undercut it 8% to guarantee a quick sale`
    }
  }

  if (bestSellRec) {
    recs.push({ action: 'sell', text: bestSellRec, impact: 'positive' })
  } else if (swords + shields + crowns > 0) {
    const bestItem = crowns > 0 ? 'Legendary Crown' : shields > 0 ? 'Rare Shield' : 'Common Sword'
    const floor = crowns > 0 ? crownFloor : shields > 0 ? shieldFloor : swordFloor
    const target = (floor * 1.5).toFixed(2)
    recs.push({ action: 'sell', text: `List your ${bestItem} at ${target} PXL — no competing listings, price 50% above the ${floor.toFixed(2)} PXL floor to maximize profit`, impact: 'positive' })
  }

  // ── Recommendation 2: Best buy opportunity ───────────────────────────
  let bestBuyRec = ''
  if (swordListing && swordListing <= swordFloor * 1.1 && pxl >= swordListing) {
    bestBuyRec = `Buy the Common Sword listed at ${swordListing.toFixed(2)} PXL — at or below the ${swordFloor.toFixed(2)} PXL floor, resell later when demand rises`
  } else if (shieldListing && shieldListing <= shieldFloor * 1.1 && pxl >= shieldListing) {
    bestBuyRec = `Buy the Rare Shield at ${shieldListing.toFixed(2)} PXL — near floor value (${shieldFloor.toFixed(2)} PXL), has upside if game rating increases`
  } else if (crownListing && crownListing <= crownFloor * 1.2 && pxl >= crownListing) {
    bestBuyRec = `Buy the Legendary Crown at ${crownListing.toFixed(2)} PXL — within 20% of floor (${crownFloor.toFixed(2)} PXL), highest-rarity item appreciates fastest`
  } else if (swordListing && pxl >= swordListing) {
    const premium = ((swordListing / swordFloor - 1) * 100).toFixed(0)
    recs.push({ action: 'skip', text: `Skip the Common Sword at ${swordListing.toFixed(2)} PXL — ${premium}% above floor (${swordFloor.toFixed(2)} PXL), not worth it`, impact: 'neutral' })
  }

  if (bestBuyRec) {
    recs.push({ action: 'buy', text: bestBuyRec, impact: 'positive' })
  }

  // ── Recommendation 3: DEX / cross-game strategy ──────────────────────
  const dngnRating = parseFloat(String(ratings?.DungeonDrops || '1').replace(' stars', ''))
  const hrvRating = parseFloat(String(ratings?.HarvestField || '1').replace(' stars', ''))

  if (dngn > 100 && dngnPrice > 0) {
    const pxlFromDngn = (dngn * dngnPrice).toFixed(2)
    recs.push({
      action: 'swap',
      text: `Swap your ${dngn.toFixed(0)} DNGN to ~${pxlFromDngn} PXL on the DEX (rate: ${dngnPrice.toFixed(4)} PXL/DNGN) — then buy Harvest items if HarvestField (${hrvRating.toFixed(1)}★) outperforms DungeonDrops (${dngnRating.toFixed(1)}★)`,
      impact: dngnRating < hrvRating ? 'positive' : 'neutral',
    })
  } else if (hrv > 100 && hrvPrice > 0) {
    const pxlFromHrv = (hrv * hrvPrice).toFixed(2)
    recs.push({
      action: 'swap',
      text: `Swap your ${hrv.toFixed(0)} HRV to ~${pxlFromHrv} PXL on the DEX (rate: ${hrvPrice.toFixed(4)} PXL/HRV) — use PXL to buy Dungeon items if DungeonDrops (${dngnRating.toFixed(1)}★) outperforms`,
      impact: hrvRating < dngnRating ? 'positive' : 'neutral',
    })
  } else if (pxl > 200) {
    const dngnYouGet = (100 / dngnPrice).toFixed(0)
    recs.push({
      action: 'swap',
      text: `Swap 100 PXL to ~${dngnYouGet} DNGN (rate: ${dngnPrice.toFixed(4)} PXL/DNGN) — enough for ${Math.floor(parseFloat(dngnYouGet) / 10)} dungeon runs to farm items and list above floor`,
      impact: 'positive',
    })
  }

  // Fill to 3 if needed
  if (recs.length < 3) {
    if (harvestItems > 0) {
      recs.push({ action: 'sell', text: `List your ${harvestItems} Seasonal Harvest Item(s) on the marketplace — production cost was near-zero (staking rewards), so any PXL is pure profit`, impact: 'positive' })
    } else {
      recs.push({ action: 'stake', text: `Stake HRV in HarvestField for 100 blocks to earn a Seasonal Harvest Item for free — staked tokens are returned with rewards`, impact: 'positive' })
    }
  }

  return { recommendations: recs.slice(0, 3) }
}
