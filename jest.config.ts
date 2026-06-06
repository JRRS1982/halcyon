import type { Config } from "jest";
// The explicit .js extension matters: on Node >=22.18 jest 30 loads this file
// with native type stripping + ESM resolution, where bare "next/jest" fails.
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
    // Nested git worktrees (e.g. .claude/worktrees/*) carry their own copies of
    // src/ and e2e/; without this, a test run here crawls into them.
    "<rootDir>/.claude/worktrees/",
    // Integration tests (real Postgres, node env) run via jest.integration.config.
    "\\.int\\.test\\.",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Jest 30's haste map scans build output; .next/standalone carries a copy of
  // package.json which collides with the root one.
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/.claude/worktrees/",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
    "<rootDir>/.next/",
    "<rootDir>/.claude/worktrees/",
  ],
};

export default createJestConfig(config);
