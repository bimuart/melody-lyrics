/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LYRICS_ANNOTATE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
