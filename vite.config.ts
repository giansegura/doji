import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:4780' },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['**/*.test.ts'] } },
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['**/*.test.tsx'], setupFiles: ['src/test/setup.ts'] },
      },
    ],
  },
})
