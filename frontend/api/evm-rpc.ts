import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  const rpcUrl = process.env.EVM_RPC_URL
  if (!rpcUrl) {
    return res.status(500).json({ error: 'EVM_RPC_URL not configured in Vercel env vars' })
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const data = await response.text()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(response.status).send(data)
  } catch (err: any) {
    console.error('EVM RPC proxy error:', err?.message)
    return res.status(502).json({ error: 'RPC proxy failed: ' + (err?.message || 'unknown') })
  }
}
