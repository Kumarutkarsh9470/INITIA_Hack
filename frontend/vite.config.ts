import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
})
