import type { VercelRequest, VercelResponse } from '@vercel/node'

async function fetchWithRetry(url: string, body: string, retries = 2): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return response
    } catch (err: any) {
      lastError = err
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastError
}

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
    const body = JSON.stringify(req.body)
    const response = await fetchWithRetry(rpcUrl, body)

    const data = await response.text()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(response.status).send(data)
  } catch (err: any) {
    console.error('EVM RPC proxy error:', err?.message)
    return res.status(502).json({ error: 'RPC proxy failed: ' + (err?.message || 'unknown') })
  }
}
