/**
 * 结构化日志 —— 从 middleware.ts 中提取的纯逻辑部分
 * 不依赖 Express，可被 server-core 内部模块通用
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const cfgLevel: LogLevel =
  (process.env.MINI_LOG_LEVEL as LogLevel) in LEVEL_ORDER
    ? (process.env.MINI_LOG_LEVEL as LogLevel)
    : 'info';

const useJson = process.env.MINI_LOG_FORMAT === 'json';

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[cfgLevel]) return;
  const ts = new Date().toISOString();
  if (useJson) {
    const record = { ts, level, msg, ...fields };
    (level === 'error' ? console.error : console.log)(JSON.stringify(record));
  } else {
    const fieldStr = fields && Object.keys(fields).length
      ? ' ' + Object.entries(fields)
          .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(' ')
      : '';
    (level === 'error' ? console.error : console.log)(
      `${ts} [${level.toUpperCase()}] ${msg}${fieldStr}`,
    );
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
