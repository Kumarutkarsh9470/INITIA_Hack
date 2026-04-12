import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    return res.status(204).end()
  }

  const restUrl = process.env.COSMOS_REST_URL

  if (!restUrl) {
    return res.status(500).json({
      error: 'COSMOS_REST_URL not configured'
    })
  }

  const pathParts = req.query.path

  const subPath = pathParts
    ? '/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts)
    : ''

  const forwardParams = new URLSearchParams()

  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue

    if (Array.isArray(v)) {
      v.forEach((val) => forwardParams.append(k, val))
    } else if (v) {
      forwardParams.append(k, v as string)
    }
  }

  const qs = forwardParams.toString()
  const targetUrl = restUrl + subPath + (qs ? '?' + qs : '')

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body:
        req.method === 'POST'
          ? JSON.stringify(req.body)
          : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await response.text()

    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') || 'application/json'
    )
    res.setHeader('Access-Control-Allow-Origin', '*')

    return res.status(response.status).send(data)
  } catch (err: any) {
    return res.status(502).json({
      error: 'Proxy failed: ' + (err?.message || 'unknown'),
    })
  }
}
