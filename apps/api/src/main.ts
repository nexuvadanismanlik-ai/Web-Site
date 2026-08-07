import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppValidationPipe } from './common/pipes/app-validation.pipe';
import { resolveTrustProxy, type AppEnvironment } from './config/app.config';
import { assertEnvironmentMatches } from './common/environment-guard';
import { PrismaService } from './prisma/prisma.service';

/** Requests per minute per client for the API at large. */
const MAX_PER_MINUTE = 100;
/** Requests per minute per client for password sign-in specifically. */
const SIGN_IN_MAX_PER_MINUTE = 5;

/** Matches the sign-in route under any global prefix or version segment. */
function isSignInAttempt(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0] ?? '';
  return path.endsWith('/auth/login');
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env['NODE_ENV'] === 'development',
      // The adapter is built before ConfigModule has loaded .env, so this reads
      // process.env directly. Only deployed environments need it, and there the
      // variable is a real one set by the platform.
      trustProxy: resolveTrustProxy(
        process.env['TRUST_PROXY'],
        process.env['NODE_ENV'] ?? 'development',
      ),
    }),
  );

  // Validate required secrets before the server accepts any traffic. This runs
  // after module init so values from .env (loaded by ConfigModule) count —
  // reading process.env earlier would only see variables exported by the shell.
  // A missing JWT secret would produce unsigned tokens that any server accepts.
  const secrets = app.get(ConfigService);
  if (!secrets.get<string>('jwt.accessSecret') || !secrets.get<string>('jwt.refreshSecret')) {
    console.error(
      'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set. Refusing to start.',
    );
    process.exit(1);
  }

  // Multipart support for file uploads
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 5,
    },
  });

  // Rate limiting. The limiter keys on req.ip, which is only meaningful once
  // trustProxy is set above — otherwise every visitor shares one bucket.
  //
  // Sign-in gets a much tighter allowance than the rest of the API: it is the
  // one unauthenticated endpoint where a caller is guessing a secret. Argon2
  // already makes each attempt cost seconds; this caps how many can be queued.
  //
  // It needs its own counter, not just its own threshold. The plugin keeps one
  // running count per key, so a shared bucket would measure sign-ins against
  // every other call from the same address — and the admin panel calls this API
  // server-side, meaning all of its traffic arrives from one address. A tight
  // threshold over a shared count locks the panel out of its own login.
  await app.register(import('@fastify/rate-limit'), {
    keyGenerator: (req: { url?: string; ip?: string }) =>
      isSignInAttempt(req.url) ? `signin:${req.ip ?? 'unknown'}` : (req.ip ?? 'unknown'),
    max: (req: { url?: string }) =>
      isSignInAttempt(req.url) ? SIGN_IN_MAX_PER_MINUTE : MAX_PER_MINUTE,
    timeWindow: '1 minute',
  });

  const config = app.get(ConfigService);

  // Before anything writes: is this the database this process belongs to?
  await assertEnvironmentMatches(
    app.get(PrismaService),
    config.get<AppEnvironment>('app.env', 'local'),
    process.env['DATABASE_URL'],
  );

  const port = config.get<number>('app.port', 4000);
  const prefix = config.get<string>('app.prefix', 'api/v1');
  const corsOrigins = config.get<string>('app.corsOrigins', '').split(',').filter(Boolean);

  app.setGlobalPrefix(prefix);

  app.enableVersioning({ type: VersioningType.URI });

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  // Strict for everything a person is waiting on; see AppValidationPipe for the
  // two payloads that opt out and why they have to.
  app.useGlobalPipes(
    new AppValidationPipe({
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
