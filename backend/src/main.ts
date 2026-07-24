import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './modules/app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { isCorsOriginAllowed } from './shared/security/cors.config';

async function bootstrap(): Promise<void> {
  const bodyLimit = Number(process.env.API_BODY_LIMIT_BYTES ?? 1_048_576);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit }),
  );
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('api.port');
  const host = configService.getOrThrow<string>('api.host');
  const allowedOrigins = configService.getOrThrow<string[]>('api.security.allowedOrigins');
  const nodeEnv = configService.getOrThrow<string>('api.nodeEnv');

  if (nodeEnv === 'production' && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be configured in production.');
  }

  app.setGlobalPrefix('api');
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isCorsOriginAllowed(origin, allowedOrigins));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(helmet, {
    hsts:
      nodeEnv === 'production'
        ? {
            includeSubDomains: true,
            maxAge: 31_536_000,
            preload: true,
          }
        : false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port, host);
}

void bootstrap();
