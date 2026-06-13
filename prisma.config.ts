import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads `.env`, so this config deliberately loads no env
// file. The migration connection string is read from `process.env.DIRECT_URL`
// (the direct, non-pooled connection) — injected by Docker Compose locally and by
// the workflow in CI. We read `process.env` directly rather than the `env()`
// helper so an unset var yields `undefined` (Prisma fails loudly) instead of the
// helper throwing at config-load time, which would break the host `prisma
// generate` in `postinstall` where no DB URL is set. A stray host `prisma
// migrate` still fails loudly instead of silently targeting production (see
// CLAUDE.md "local vs prod DB trap"). Run migrations inside the container.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
