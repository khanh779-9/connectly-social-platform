/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_IDENTITY_API_URL: string;
  readonly VITE_CHAT_HUB_URL: string;
  readonly VITE_NOTIFICATION_HUB_URL: string;
  readonly VITE_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
