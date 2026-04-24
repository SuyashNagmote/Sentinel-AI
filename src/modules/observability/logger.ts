type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel) {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function emit(level: LogLevel, event: string, payload: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/** Backwards-compatible — logs at "info" level */
export function logEvent(event: string, payload: Record<string, unknown>) {
  emit("info", event, payload);
}

export function logDebug(event: string, payload: Record<string, unknown> = {}) {
  emit("debug", event, payload);
}

export function logInfo(event: string, payload: Record<string, unknown> = {}) {
  emit("info", event, payload);
}

export function logWarn(event: string, payload: Record<string, unknown> = {}) {
  emit("warn", event, payload);
}

export function logError(event: string, error: unknown, payload: Record<string, unknown> = {}) {
  const errData =
    error instanceof Error
      ? { errorMessage: error.message, errorStack: error.stack }
      : { errorMessage: String(error) };

  emit("error", event, { ...errData, ...payload });
}
