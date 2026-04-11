import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  const restUrl = process.env.COSMOS_REST_URL
  if (!restUrl) {
    return res.status(500).json({ error: 'COSMOS_REST_URL not configured in Vercel env vars' })
  }

  const subPath = req.query.path
    ? `/${Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path}`
    : ''
  const url = `${restUrl}${subPath}`

  try {
    const response = await fetch(url, {
      method: req.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.text()
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(response.status).send(data)
  } catch (err: any) {
    console.error('Cosmos REST proxy error:', err?.message)
    return res.status(502).json({ error: 'Cosmos REST proxy failed: ' + (err?.message || 'unknown') })
  }
}
