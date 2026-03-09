import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Trust the first proxy (nginx, ALB, etc.) so ThrottlerGuard sees the real
  // client IP from X-Forwarded-For instead of the load balancer address.
  // Without this, all requests appear to come from the same IP and rate
  // limiting is effectively disabled in any deployed environment.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get('PORT') || 3000;
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';

  // CORS — in production, only the origins listed in CORS_ORIGIN (comma-separated)
  // are allowed. In other environments the restriction is lifted for convenience.
  const rawOrigins = configService.get<string>('CORS_ORIGIN');
  const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim())
    : [];

  app.enableCors({
    origin: isProduction ? allowedOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
    credentials: true,
    maxAge: 86400, // cache preflight for 24 h
  });

  // Swagger — never exposed in production
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Employer Contribution Management API')
      .setDescription(
        'API for managing employer contributions including pension, medical insurance, and maternity leave',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Employers', 'Employer profile management')
      .addTag('Employees', 'Employee registration and management')
      .addTag('Declarations', 'Monthly contribution declarations')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
