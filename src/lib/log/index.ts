// Vendor-neutral application logger.
//
// Call sites use `log.info` / `log.warn` / `log.error` / `log.debug` and never
// touch `console` directly. The implementation here is the single swap point:
// today it writes structured lines to the console (which Vercel ingests into
// its log drains for free); swapping in Sentry/Axiom/etc. later means editing
// only `emit` below, not the call sites.

type LogLevel = "debug" | "info" | "warn" | "error";

// Arbitrary structured context. An `Error` anywhere in here (by convention
// under the `err` key) is expanded into name/message/stack so it survives
// JSON serialisation.
type LogMeta = Record<string, unknown>;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function serializeError(error: Error): Record<string, unknown> {
  return { name: error.name, message: error.message, stack: error.stack };
}

function normalizeMeta(meta: LogMeta): LogMeta {
  const entries = Object.entries(meta).map(([key, value]) =>
    value instanceof Error ? [key, serializeError(value)] : [key, value],
  );
  return Object.fromEntries(entries);
}

function consoleFor(level: LogLevel): (...args: unknown[]) => void {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  if (level === "info") return console.info;
  return console.debug;
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const write = consoleFor(level);
  const normalized = meta ? normalizeMeta(meta) : undefined;

  if (isProduction()) {
    write(
      JSON.stringify({
        level,
        message,
        time: new Date().toISOString(),
        ...normalized,
      }),
    );
    return;
  }

  if (normalized) {
    write(`[${level}] ${message}`, normalized);
    return;
  }
  write(`[${level}] ${message}`);
}

export const log = {
  debug: (message: string, meta?: LogMeta) => emit("debug", message, meta),
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
};
