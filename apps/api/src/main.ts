import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  app.enableCors({ origin, credentials: true });

  await app.listen(3001);
  console.log(`API running on http://localhost:3001/api/v1`);
}

bootstrap();
