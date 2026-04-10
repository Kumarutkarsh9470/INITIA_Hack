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
 * POST /api/faucet  { "tba": "0x..." }
 * Sends 10 000 PXL + 500 DNGN + 500 HRV from the deployer to the TBA.
 */
function faucetPlugin(): Plugin {
  return {
    name: 'faucet-api',
    configureServer(server) {
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
          const { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData } = await import('viem')
          const { privateKeyToAccount } = await import('viem/accounts')

          const pk = process.env.VITE_DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY
          if (!pk) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'No deployer key configured (set VITE_DEPLOYER_PRIVATE_KEY)' }))
            return
          }

          const rpcUrl = process.env.MINIEVM_RPC_URL || 'http://localhost:8545'
          const transport = http(rpcUrl)
          const account = privateKeyToAccount(pk as `0x${string}`)

          // Deployed addresses
          const addresses = (await import('../deployed-addresses.json', { assert: { type: 'json' } })).default
          const pxl = addresses.PXLToken as `0x${string}`
          const dngn = addresses.DungeonDropsToken as `0x${string}`
          const hrv = addresses.HarvestFieldToken as `0x${string}`

          // Minimal ERC-20 transfer ABI
          const abi = [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }] as const

          const client = createWalletClient({ account, transport })
          const pub = createPublicClient({ transport })
          const chainId = await pub.getChainId()

          const chain = { id: chainId, name: 'minievm', nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }

          const send = async (token: `0x${string}`, amount: bigint) => {
            const data = encodeFunctionData({ abi, functionName: 'transfer', args: [tba as `0x${string}`, amount] })
            return client.sendTransaction({ to: token, data, chain, account })
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

export default defineConfig({
  server: {
    proxy: {
      '/evm-rpc': {
        target: 'http://localhost:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/evm-rpc/, ''),
      },
      '/cosmos-rpc': {
        target: 'http://localhost:26657',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cosmos-rpc/, ''),
      },
      '/cosmos-rest': {
        target: 'http://localhost:1317',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cosmos-rest/, ''),
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('viem') || id.includes('wagmi') || id.includes('@tanstack')) {
              return 'vendor-web3';
            }
            if (id.includes('@initia') || id.includes('interwovenkit') || id.includes('@cosmjs')) {
              return 'vendor-initia';
            }
            if (id.includes('@walletconnect') || id.includes('@coinbase') || id.includes('@base-org')) {
              return 'vendor-wallets';
            }
          }
        },
      },
    },
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
