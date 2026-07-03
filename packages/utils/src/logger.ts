export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: boolean | null | number | string | undefined;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
}

export class ConsoleLogger implements Logger {
  public debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  public error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    const payload = {
      context,
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (level === 'error') {
      console.error(payload);
      return;
    }

    if (level === 'warn') {
      console.warn(payload);
      return;
    }

    console.log(payload);
  }
}
