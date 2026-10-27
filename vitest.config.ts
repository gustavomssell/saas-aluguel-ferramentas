import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/src/**/*.test.ts', 'web/src/**/*.test.ts'],
    environment: 'node',
  },
})
