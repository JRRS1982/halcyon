import type { Config } from "jest";
import nextJest from "next/jest";

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
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
    "<rootDir>/.next/",
    "<rootDir>/.claude/worktrees/",
  ],
};

export default createJestConfig(config);
