import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration + unit tests.
 *
 * Run:  npm test
 *   requires a .env.test file (see .env.test.example) pointing at a test DB.
 *   The test DB must have migrations applied:
 *     node --env-file=.env.test src/config/migrate.js
 *
 * Tests run sequentially (singleFork) to avoid parallel writes corrupting
 * the shared test DB.  The tradeoff (slower) is acceptable for a CI suite
 * of this size.
 */
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
