/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages ではリポジトリ全体で単一の dist/ を公開するため、
// サンプルごとの成果物はリポジトリ直下の dist/<制作種別>/<業種の抽象名>/ へ出力する。
export default defineConfig({
  plugins: [react()],
  base: '/samples-react/booking/photo-studio-admin/',
  build: {
    outDir: fileURLToPath(new URL('../../../dist/booking/photo-studio-admin', import.meta.url)),
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
