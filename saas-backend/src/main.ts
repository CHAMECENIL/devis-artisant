import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Security middleware
  // 'unsafe-inline' requis car le frontend utilise des scripts inline dans les pages HTML
  app.use((helmet as any)({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:      ["'self'"],
        scriptSrc:       ["'self'", "'unsafe-inline'"],
        scriptSrcAttr:   ["'unsafe-inline'"],
        styleSrc:        ["'self'", 'https:', "'unsafe-inline'"],
        imgSrc:          ["'self'", 'data:', 'blob:'],
        fontSrc:         ["'self'", 'https:', 'data:'],
        objectSrc:       ["'none'"],
        baseUri:         ["'self'"],
        formAction:      ["'self'"],
        frameAncestors:  ["'self'"],
        connectSrc:      ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  }));
  app.use((compression as any)());

  // CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
  });

  // ── Servir le frontend statique (login.html, index.html, css/, js/) ──
  // process.cwd() = saas-backend/ (npm --prefix saas-backend)
  const frontendPath = path.join(process.cwd(), '..', 'frontend');
  app.useStaticAssets(frontendPath);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Devis Artisan SaaS API')
    .setDescription(
      'API REST multi-tenant pour la gestion de devis artisans BTP avec IA',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Authentification et gestion des tokens')
    .addTag('tenants', 'Gestion des tenants (artisans)')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('clients', 'Gestion des clients')
    .addTag('devis', 'Gestion des devis')
    .addTag('documents', 'Gestion des documents (GED)')
    .addTag('ai', 'Fonctionnalités IA (génération de devis)')
    .addTag('billing', 'Facturation et abonnements Stripe')
    .addTag('admin', 'Administration plateforme')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Application running on: http://localhost:${port}/api/v1`, 'Bootstrap');
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Bootstrap error (DB/Redis may be unavailable):', err.message);
  // Don't exit — let the process stay alive so the preview can load Swagger docs
});
