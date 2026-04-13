import type { VercelRequest, VercelResponse } from '@vercel/node'

async function fetchWithRetry(url: string, opts: RequestInit, retries = 2): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const response = await fetch(url, { ...opts, signal: controller.signal })
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
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  const rpcUrl = process.env.COSMOS_RPC_URL
  if (!rpcUrl) {
    return res.status(500).json({ error: 'COSMOS_RPC_URL not configured in Vercel env vars' })
  }

  const subPath = req.query.path
    ? `/${Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path}`
    : ''
  const url = `${rpcUrl}${subPath}`

  try {
    const response = await fetchWithRetry(url, {
      method: req.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.text()
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(response.status).send(data)
  } catch (err: any) {
    console.error('Cosmos RPC proxy error:', err?.message)
    return res.status(502).json({ error: 'Cosmos RPC proxy failed: ' + (err?.message || 'unknown') })
  }
}
