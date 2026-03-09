import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const lang = this.resolveLang(request);
    const { status, errorName, message } = this.extractError(exception);

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const translatedMessage = this.translate(message, lang);

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message: translatedMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  // ── private helpers ─────────────────────────────────────────────────────────

  private extractError(exception: unknown): {
    status: number;
    errorName: string;
    message: string | string[];
  } {
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorName: 'Internal Server Error',
        message: 'errors.common.internal_error',
      };
    }

    const status = exception.getStatus();
    // Convert "NotFoundException" → "Not Found", "ConflictException" → "Conflict"
    const errorName = exception.constructor.name.replace(/Exception$/, '');

    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return { status, errorName, message: raw };
    }

    if (typeof raw === 'object' && raw !== null) {
      const body = raw as Record<string, unknown>;
      const msg = body['message'];
      if (Array.isArray(msg)) {
        return { status, errorName, message: msg as string[] };
      }
      if (typeof msg === 'string') {
        return { status, errorName, message: msg };
      }
    }

    return { status, errorName, message: 'errors.common.internal_error' };
  }

  private translate(
    message: string | string[],
    lang: string,
  ): string | string[] {
    if (Array.isArray(message)) {
      return message.map((m) => this.translateOne(m, lang));
    }
    return this.translateOne(message, lang);
  }

  private translateOne(key: string, lang: string): string {
    // Only attempt translation for dot-namespaced keys (e.g. "errors.auth.email_exists").
    // Raw messages from class-validator or Passport are passed through unchanged.
    if (!key.includes('.')) return key;

    const translated = this.i18n.translate(key as any, { lang });
    // nestjs-i18n returns the key itself when no translation is found;
    // in that case fall back to the original key so nothing is swallowed.
    return (translated as string) ?? key;
  }

  private resolveLang(request: Request): string {
    const header = request.headers['accept-language'];
    if (!header) return 'en';
    // Take the highest-priority tag, strip quality values and whitespace.
    return header.split(',')[0].split(';')[0].trim() || 'en';
  }
}
