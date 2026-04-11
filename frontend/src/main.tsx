import { Buffer } from 'buffer'
;(window as any).Buffer = Buffer
;(window as any).process = { env: { NODE_ENV: import.meta.env.MODE } }

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@initia/interwovenkit-react/styles.css'
import {
  injectStyles,
  InterwovenKitProvider,
  TESTNET,
} from '@initia/interwovenkit-react'
import InterwovenKitStyles from '@initia/interwovenkit-react/styles.js'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

injectStyles(InterwovenKitStyles)

const queryClient = new QueryClient()

// In dev, Vite proxies /evm-rpc, /cosmos-rpc, /cosmos-rest to localhost.
// In production (Vercel), env vars point directly to public endpoints,
// or Vercel serverless functions act as proxies at the same paths.
const origin = window.location.origin
const evmRpc = import.meta.env.VITE_JSON_RPC_URL ?? `${origin}/evm-rpc`
const cosmosRpc = import.meta.env.VITE_COSMOS_RPC_URL ?? `${origin}/cosmos-rpc`
const cosmosRest = import.meta.env.VITE_COSMOS_REST_URL ?? `${origin}/cosmos-rest`

// Define PixelVault MiniEVM as a viem/wagmi chain
const pixelvaultChain = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID ?? 2891653883154692),
  name: 'PixelVault Appchain',
  nativeCurrency: {
    name: import.meta.env.VITE_NATIVE_SYMBOL ?? 'GAS',
    symbol: import.meta.env.VITE_NATIVE_SYMBOL ?? 'GAS',
    decimals: Number(import.meta.env.VITE_NATIVE_DECIMALS ?? 18),
  },
  rpcUrls: {
    default: {
      http: [evmRpc],
    },
  },
})

const wagmiConfig = createConfig({
  chains: [pixelvaultChain],
  transports: { [pixelvaultChain.id]: http(evmRpc) },
})

const customChain = {
  chain_id: import.meta.env.VITE_APPCHAIN_ID,
  chain_name: 'pixelvault',
  pretty_name: 'PixelVault Appchain',
  network_type: 'testnet',
  bech32_prefix: 'init',
  logo_URIs: {
    png: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png',
    svg: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.svg',
  },
  apis: {
    rpc: [{ address: cosmosRpc }],
    rest: [{ address: cosmosRest }],
    indexer: [{ address: cosmosRest }],
    'json-rpc': [{ address: evmRpc }],
  },
  fees: {
    fee_tokens: [
      {
        denom: import.meta.env.VITE_NATIVE_DENOM,
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: import.meta.env.VITE_NATIVE_DENOM }],
  },
  metadata: {
    minitia: { type: 'minievm' },
    is_l1: false,
  },
  native_assets: [
    {
      denom: import.meta.env.VITE_NATIVE_DENOM,
      name: 'Native Token',
      symbol: import.meta.env.VITE_NATIVE_SYMBOL,
      decimals: Number(import.meta.env.VITE_NATIVE_DECIMALS ?? 18),
    },
  ],
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={customChain.chain_id}
          customChain={customChain}
          enableAutoSign={true}
        >
          <BrowserRouter>
            <App />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#ffffff',
                  color: '#212529',
                  border: '1px solid #e9ecef',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
              }}
            />
          </BrowserRouter>
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
