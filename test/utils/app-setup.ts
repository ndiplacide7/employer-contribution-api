import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const dataSource = moduleFixture.get(DataSource);
  return { app, dataSource };
}

export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE contribution_lines CASCADE');
  await dataSource.query('TRUNCATE TABLE declarations CASCADE');
  await dataSource.query('TRUNCATE TABLE employees CASCADE');
  await dataSource.query('TRUNCATE TABLE employers CASCADE');
  await dataSource.query('TRUNCATE TABLE users CASCADE');
}

export async function registerAndLogin(
  app: INestApplication,
  email: string,
  password: string,
  role?: string,
): Promise<string> {
  const payload: any = { email, password };
  if (role) payload.role = role;

  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send(payload)
    .expect(201);

  return res.body.accessToken;
}
