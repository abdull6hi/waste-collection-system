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
    // Run test FILES one at a time. The schema has a users↔collectors FK cycle,
    // so concurrent `TRUNCATE … CASCADE` in per-file setup can deadlock; serial
    // execution against the shared test DB avoids that. (vitest 4 replacement for
    // the removed poolOptions-based serialization.)
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
