import type { VercelRequest, VercelResponse } from '@vercel/node'

function normalizeHash(raw: string): string | null {
  const trimmed = raw.trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return null
  return trimmed.slice(2).toUpperCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const rawTxHash = String(req.query.txHash || '')
  const txHash = normalizeHash(rawTxHash)
  if (!txHash) {
    return res.status(400).json({ error: 'Provide txHash as 0x-prefixed 32-byte hash' })
  }

  const restUrl = process.env.COSMOS_REST_URL
  if (!restUrl) {
    return res.status(500).json({ error: 'COSMOS_REST_URL not configured' })
  }

  const base = restUrl.replace(/\/$/, '')
  const targetUrl = `${base}/cosmos/tx/v1beta1/txs/${txHash}`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({
        ok: false,
        txHash: rawTxHash,
        error: `Cosmos tx lookup failed (${response.status})`,
        details: text.slice(0, 300),
      })
    }

    const data = await response.json()
    const amounts = data?.tx?.auth_info?.fee?.amount
    const firstCoin = Array.isArray(amounts) && amounts.length > 0 ? amounts[0] : null

    if (!firstCoin?.amount || !firstCoin?.denom) {
      return res.status(200).json({ ok: true, txHash: rawTxHash, fee: null })
    }

    return res.status(200).json({
      ok: true,
      txHash: rawTxHash,
      fee: {
        amount: String(firstCoin.amount),
        denom: String(firstCoin.denom),
      },
    })
  } catch (err: any) {
    return res.status(502).json({
      ok: false,
      txHash: rawTxHash,
      error: err?.message || 'Resolver failed',
    })
  }
}
