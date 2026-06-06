import type { Config } from "jest";
// The explicit .js extension matters: on Node >=22.18 jest 30 loads this file
// with native type stripping + ESM resolution, where bare "next/jest" fails.
import nextJest from "next/jest.js";

// Integration tests run the real server actions against a real Postgres
// (halcyon_test), with only the Supabase auth boundary mocked. Run via
// `pnpm test:int`, which pins DATABASE_URL/DIRECT_URL at the test DB. Node env
// (no jsdom), serial (one shared DB), and matched by the `.int.test.ts` suffix.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "node",
  globalSetup: "<rootDir>/test/integration/globalSetup.ts",
  setupFilesAfterEnv: ["<rootDir>/test/integration/setup.ts"],
  testMatch: ["**/*.int.test.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  maxWorkers: 1,
};

export default createJestConfig(config);
