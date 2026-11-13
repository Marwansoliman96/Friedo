/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_RESTAURANT_NAME?: string;
  readonly VITE_RESTAURANT_PHONE?: string;
  readonly VITE_GOOGLE_SHEET_WEBAPP_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_TENANT_ID?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
