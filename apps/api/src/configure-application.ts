import {
  ClassSerializerInterceptor,
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpRequestLoggingInterceptor } from './http-request-logging.interceptor';

export function configureApplication(app: INestApplication): void {
  const server = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
  };
  server.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new HttpRequestLoggingInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
}
