import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Validate required secrets before touching anything else.
  // A missing JWT secret would produce unsigned tokens that any server accepts.
  const accessSecret = process.env['JWT_ACCESS_SECRET'];
  const refreshSecret = process.env['JWT_REFRESH_SECRET'];
  if (!accessSecret || !refreshSecret) {
    console.error(
      'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set. Refusing to start.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env['NODE_ENV'] === 'development' }),
  );

  // Multipart support for file uploads
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 5,
    },
  });

  // Rate limiting — protects login and other public endpoints
  await app.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    // Login endpoint has a tighter limit applied via route-level override
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 4000);
  const prefix = config.get<string>('app.prefix', 'api/v1');
  const corsOrigins = config.get<string>('app.corsOrigins', '').split(',').filter(Boolean);

  app.setGlobalPrefix(prefix);

  app.enableVersioning({ type: VersioningType.URI });

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env['NODE_ENV'] !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nexuva OS API')
      .setDescription('Nexuva Holding Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }

  await app.listen(port, '0.0.0.0');
  console.warn(`Nexuva OS API running on port ${port} [${process.env['NODE_ENV']}]`);
}

bootstrap();
