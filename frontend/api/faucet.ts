import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  encodeFunctionData,
  getAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Normalize env-var addresses to EIP-55 checksum (handles wrong case / trailing whitespace)
function safeAddr(raw: string | undefined): `0x${string}` | null {
  if (!raw) return null
  try { return getAddress(raw.trim()) } catch { return null }
}

const PXL_TOKEN = safeAddr(process.env.PXL_TOKEN_ADDRESS)
const DNGN_TOKEN = safeAddr(process.env.DNGN_TOKEN_ADDRESS)
const HRV_TOKEN = safeAddr(process.env.HRV_TOKEN_ADDRESS)

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
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const rawTba = req.body?.tba as string | undefined
  if (!rawTba || !rawTba.startsWith('0x') || rawTba.trim().length !== 42) {
    return res.status(400).json({ error: 'Send { "tba": "0x..." }' })
  }
  let tba: `0x${string}`
  try {
    tba = getAddress(rawTba.trim())
  } catch {
    return res.status(400).json({ error: 'Invalid TBA address checksum' })
  }

  const pk = process.env.PRIVATE_KEY
  if (!pk) {
    return res.status(500).json({ error: 'No deployer key configured' })
  }

  if (!PXL_TOKEN || !DNGN_TOKEN || !HRV_TOKEN) {
    return res.status(500).json({ error: 'Token addresses not configured' })
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

    let nonce = await pub.getTransactionCount({ address: account.address })

    const send = async (token: `0x${string}`, amount: bigint) => {
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [tba as `0x${string}`, amount],
      })
      const hash = await client.sendTransaction({
        to: token,
        data,
        chain,
        account,
        nonce,
      })
      nonce++
      await pub.waitForTransactionReceipt({ hash })
      return hash
    }

    await send(PXL_TOKEN, parseEther('10000'))
    await send(DNGN_TOKEN, parseEther('500'))
    await send(HRV_TOKEN, parseEther('500'))

    return res.status(200).json({ ok: true, funded: tba })
  } catch (err: any) {
    console.error('Faucet error:', err)
    return res.status(500).json({ error: err?.message || 'Faucet transfer failed' })
  }
}
