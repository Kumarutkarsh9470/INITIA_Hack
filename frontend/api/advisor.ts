import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROK_API_KEY not configured' })

  const { inventory, balances, floorPrices, listings, ratings } = req.body
  if (!inventory || !balances) return res.status(400).json({ error: 'Missing portfolio data' })

  const prompt = `You are a trading advisor for PixelVault, a cross-game blockchain economy.

PLAYER PORTFOLIO:
Token balances: ${JSON.stringify(balances)}
Inventory items: ${JSON.stringify(inventory)}

MARKET DATA:
Item floor prices (PXL): ${JSON.stringify(floorPrices)}
Active marketplace listings: ${JSON.stringify(listings)}
Game ratings (1-5 stars, higher = more valuable ecosystem): ${JSON.stringify(ratings)}

RULES:
- Items can be sold on marketplace for PXL
- PXL can be swapped to DNGN or HRV on the DEX
- Higher rated games have more valuable items (rating multiplier on floor price)
- A listing below floor price is a bargain worth buying
- A listing 10x above floor is overpriced, skip it

Give exactly 3 specific trading recommendations for this player.
Each must be one sentence, start with an action word (Buy/Sell/Swap/Stake/Skip).
Focus on what gives the best return given their current holdings.

Respond ONLY with valid JSON, no other text:
{"recommendations":[{"action":"buy|sell|swap|stake|skip","text":"...","impact":"positive|negative|neutral"}]}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errText = await response.text()
      console.error('Grok API error:', response.status, errText)
      return res.status(502).json({ error: 'AI service returned an error' })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim()

    if (!text) return res.status(502).json({ error: 'No response from AI' })

    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)

    return res.status(200).json(parsed)
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out' })
    }
    console.error('Advisor error:', err)
    return res.status(500).json({ error: 'Failed to get trading advice' })
  }
}
