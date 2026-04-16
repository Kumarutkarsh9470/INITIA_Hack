import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import type { Plugin } from 'vite'
import path from 'path'
import { config as dotenvConfig } from 'dotenv'

// Load root .env so PRIVATE_KEY is available to server-side plugins
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') })

/**
 * Vite plugin: in-process faucet API.
 *
 * POST /api/faucet  { "tba": "0x..." }
 *   → Sends 10 000 PXL + 500 DNGN + 500 HRV from the deployer to the TBA.
 *
 * POST /api/fund-gas  { "address": "0x..." }
 *   → Sends a small amount of native GAS so new accounts can exist on-chain
 *     and pay for their first transaction (profile mint).
 */
function faucetPlugin(): Plugin {
  return {
    name: 'faucet-api',
    configureServer(server) {

      // If no PRIVATE_KEY, proxy /api/* to production Vercel (for contributors)
      const pk = process.env.VITE_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
      if (!pk) {
        const VERCEL_URL = process.env.VERCEL_URL || 'https://pixelvault-two.vercel.app'
        console.log(`[faucet] No PRIVATE_KEY found — proxying /api/* to ${VERCEL_URL}`)
        for (const route of ['/api/fund-gas', '/api/faucet']) {
          server.middlewares.use(route, async (req, res) => {
            try {
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(chunk as Buffer)
              const upstream = await fetch(`${VERCEL_URL}${route}`, {
                method: req.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: Buffer.concat(chunks).toString(),
              })
              const data = await upstream.text()
              res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
              res.end(data)
            } catch (err: any) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Proxy to production failed: ' + err?.message }))
            }
          })
        }
        return
      }

      // ── /api/fund-gas — send native GAS to a new EVM address ──
      server.middlewares.use('/api/fund-gas', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let address: string
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString())
          address = body.address
          if (!address || !address.startsWith('0x') || address.length !== 42) throw new Error('bad')
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Send { "address": "0x..." }' }))
          return
        }

        try {
          const { createWalletClient, createPublicClient, http, parseEther, getAddress: toChecksumAddress } = await import('viem')
          const { privateKeyToAccount } = await import('viem/accounts')

          // Normalize address to EIP-55 checksum
          let normalizedAddress: `0x${string}`
          try { normalizedAddress = toChecksumAddress(address.trim()) } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid address checksum' }))
            return
          }

          const pk = process.env.VITE_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
          if (!pk) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No deployer key configured' }))
            return
          }

          const rpcUrl = process.env.MINIEVM_RPC_URL || 'http://localhost:8545'
          const transport = http(rpcUrl)
          const account = privateKeyToAccount(pk as `0x${string}`)
          const pub = createPublicClient({ transport })
          const chainId = await pub.getChainId()
          const chain = { id: chainId, name: 'minievm', nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }
          const client = createWalletClient({ account, transport })

          const hash = await client.sendTransaction({
            to: normalizedAddress,
            value: parseEther('0.1'),
            chain,
            account,
          })
          await pub.waitForTransactionReceipt({ hash })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, funded: address, hash }))
        } catch (err: any) {
          console.error('Fund-gas error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err?.message || 'Transfer failed' }))
        }
      })

      // ── /api/faucet — send ERC-20 game tokens to a TBA ──
      server.middlewares.use('/api/faucet', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'POST only' }))
          return
        }

        // Parse JSON body
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let tba: string
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString())
          tba = body.tba
          if (!tba || !tba.startsWith('0x') || tba.length !== 42) throw new Error('bad address')
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid body. Send { "tba": "0x..." }' }))
          return
        }

        try {
          // Lazy-import viem (available in node_modules)
          const { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, getAddress } = await import('viem')
          const { privateKeyToAccount } = await import('viem/accounts')

          // Normalize TBA address to EIP-55 checksum
          let normalizedTba: `0x${string}`
          try { normalizedTba = getAddress(tba.trim()) } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid TBA address checksum' }))
            return
          }

          const pk = process.env.VITE_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
          if (!pk) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No deployer key configured (set VITE_DEPLOYER_PRIVATE_KEY)' }))
            return
          }

          const rpcUrl = process.env.MINIEVM_RPC_URL || 'http://localhost:8545'
          const transport = http(rpcUrl)
          const account = privateKeyToAccount(pk as `0x${string}`)

          // Deployed addresses (normalized to EIP-55 checksum)
          const addresses = (await import('../deployed-addresses.json', { assert: { type: 'json' } })).default
          const pxl = getAddress(addresses.PXLToken)
          const dngn = getAddress(addresses.DungeonDropsToken)
          const hrv = getAddress(addresses.HarvestFieldToken)

          // Minimal ERC-20 transfer ABI
          const abi = [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }] as const

          const client = createWalletClient({ account, transport })
          const pub = createPublicClient({ transport })
          const chainId = await pub.getChainId()

          const chain = { id: chainId, name: 'minievm', nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }

          // Get nonce once, increment manually to avoid collisions on back-to-back sends
          let nonce = await pub.getTransactionCount({ address: account.address })

          const send = async (token: `0x${string}`, amount: bigint) => {
            const data = encodeFunctionData({ abi, functionName: 'transfer', args: [normalizedTba, amount] })
            const hash = await client.sendTransaction({ to: token, data, chain, account, nonce })
            nonce++
            // Wait for receipt to confirm before next tx
            await pub.waitForTransactionReceipt({ hash })
            return hash
          }

          await send(pxl, parseEther('10000'))
          await send(dngn, parseEther('500'))
          await send(hrv, parseEther('500'))

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, funded: tba }))
        } catch (err: any) {
          console.error('Faucet error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err?.message || 'Faucet transfer failed' }))
        }
      })
    },
  }
}

// Production VPS — used as dev proxy target so contributors don't need a local node
const VPS_ORIGIN = process.env.VPS_ORIGIN || 'http://207.180.203.32'

export default defineConfig({
  server: {
    proxy: {
      '/evm-rpc': {
        target: VPS_ORIGIN,
        changeOrigin: true,
      },
      '/cosmos-rpc': {
        target: VPS_ORIGIN,
        changeOrigin: true,
      },
      '/cosmos-rest': {
        target: VPS_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'wagmi', '@tanstack/react-query', 'viem'],
  },
  optimizeDeps: {
    include: ['wagmi', '@tanstack/react-query', 'viem'],
  },
  build: {
    chunkSizeWarningLimit: 6000,
  },
  plugins: [
    faucetPlugin(),
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
})
