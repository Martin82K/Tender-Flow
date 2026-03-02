/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_EXCEL_MERGER_MIRROR_URL?: string;
    readonly VITE_DOCHUB_FALLBACK_ENABLED?: string;
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
