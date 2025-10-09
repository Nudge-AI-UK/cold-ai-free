/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_URL: string
  readonly VITE_UPGRADE_URL: string
  readonly VITE_MAX_FREE_MESSAGES: string
  readonly VITE_MAX_FREE_ICPS: string
  readonly VITE_MAX_FREE_KNOWLEDGE_ENTRIES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
