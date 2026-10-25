import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof raw === 'string' ? raw : (raw as { message?: string | string[] } | undefined)?.message ?? 'Internal server error';
    const safeMessage = Array.isArray(message) ? message : String(message);
    res.status(status).json({
      statusCode: status,
      message: safeMessage,
      path: req.originalUrl,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
