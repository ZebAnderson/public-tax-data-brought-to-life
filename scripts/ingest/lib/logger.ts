type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function nowIso(): string {
  return new Date().toISOString();
}

export class Logger {
  constructor(private readonly minLevel: LogLevel = 'info') {}

  private shouldLog(level: LogLevel): boolean {
    return levelRank[level] >= levelRank[this.minLevel];
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    console.log(`[${nowIso()}] DEBUG ${message}`, meta ?? '');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    console.log(`[${nowIso()}] INFO  ${message}`, meta ?? '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    console.warn(`[${nowIso()}] WARN  ${message}`, meta ?? '');
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    console.error(`[${nowIso()}] ERROR ${message}`, meta ?? '');
  }
}

export const log = new Logger((process.env.LOG_LEVEL as LogLevel) ?? 'info');

