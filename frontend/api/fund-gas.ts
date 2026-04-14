import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createWalletClient, createPublicClient, http, parseEther, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const rawAddress = req.body?.address as string | undefined
  if (!rawAddress || !rawAddress.startsWith('0x') || rawAddress.trim().length !== 42) {
    return res.status(400).json({ error: 'Send { "address": "0x..." }' })
  }
  let address: `0x${string}`
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
    const rpcUrl = process.env.EVM_RPC_URL
    if (!rpcUrl) {
      return res.status(500).json({ error: 'EVM_RPC_URL not configured' })
    }
    const transport = http(rpcUrl)
    const account = privateKeyToAccount(pk as `0x${string}`)
    const pub = createPublicClient({ transport })
    const chainId = await pub.getChainId()
    const chain = {
      id: chainId,
      name: 'minievm',
      nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    }
    const client = createWalletClient({ account, transport })

    const hash = await client.sendTransaction({
      to: address as `0x${string}`,
      value: parseEther('0.1'),
      chain,
      account,
    })
    await pub.waitForTransactionReceipt({ hash })

    return res.status(200).json({ ok: true, funded: address, hash })
  } catch (err: any) {
    console.error('Fund-gas error:', err)
    return res.status(500).json({ error: err?.message || 'Transfer failed' })
  }
}
