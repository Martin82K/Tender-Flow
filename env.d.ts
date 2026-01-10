/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY?: string; // Now optional, moved to backend
    readonly VITE_GOOGLE_API_KEY?: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_EXCEL_MERGER_MIRROR_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
