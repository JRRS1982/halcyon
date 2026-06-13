import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";

// jsdom omits TextEncoder/TextDecoder, but Prisma 7's client eagerly initializes
// a cuid2 fingerprint (via @noble/hashes) at import time that needs them. Without
// this, any jsdom unit test that transitively imports @prisma/client — e.g. for
// Prisma.Decimal — fails to load. Node's implementations are drop-in.
Object.assign(globalThis, { TextDecoder, TextEncoder });
