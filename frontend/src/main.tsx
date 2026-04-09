import { Buffer } from 'buffer'
;(window as any).Buffer = Buffer
;(window as any).process = { env: { NODE_ENV: 'development' } }

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
import { mainnet } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

injectStyles(InterwovenKitStyles)

const queryClient = new QueryClient()
const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
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
    rpc: [{ address: 'http://localhost:26657' }],
    rest: [{ address: 'http://localhost:1317' }],
    indexer: [{ address: 'http://localhost:8080' }],
    'json-rpc': [{ address: import.meta.env.VITE_JSON_RPC_URL ?? 'http://localhost:8545' }],
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
        >
          <BrowserRouter>
            <App />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#1f2937',
                  color: '#f9fafb',
                  border: '1px solid #374151',
                },
              }}
            />
          </BrowserRouter>
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
