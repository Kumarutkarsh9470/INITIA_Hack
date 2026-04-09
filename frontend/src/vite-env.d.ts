/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPCHAIN_ID: string
  readonly VITE_NATIVE_DENOM: string
  readonly VITE_NATIVE_SYMBOL: string
  readonly VITE_NATIVE_DECIMALS: string
  readonly VITE_JSON_RPC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
