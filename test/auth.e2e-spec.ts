import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, cleanDatabase } from './utils/app-setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await cleanDatabase(dataSource);

    // Pre-register a user for duplicate-email and login tests
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'existing@test.com', password: 'Password123!', role: 'employer' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register an employer user and return an access token', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'newemployer@test.com', password: 'Password123!', role: 'employer' })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should register an admin user and return an access token', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'newadmin@test.com', password: 'Password123!', role: 'admin' })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
        });
    });

    it('should register with default employer role when role is omitted', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'norole@test.com', password: 'Password123!' })
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
        });
    });

    it('should return 409 when email already exists', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'existing@test.com', password: 'Password123!' })
        .expect(409);
    });

    it('should return 400 for an invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'Password123!' })
        .expect(400);
    });

    it('should return 400 for a password shorter than 8 characters', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'shortpwd@test.com', password: 'Short1!' })
        .expect(400);
    });

    it('should return 400 for an invalid role value', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'badrole@test.com', password: 'Password123!', role: 'superadmin' })
        .expect(400);
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'missing@test.com' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully and return an access token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'existing@test.com', password: 'Password123!' })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(typeof res.body.accessToken).toBe('string');
        });
    });

    it('should return 401 for a wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'existing@test.com', password: 'WrongPassword!' })
        .expect(401);
    });

    it('should return 401 for a non-existent email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@test.com', password: 'Password123!' })
        .expect(401);
    });

    it('should return 400 for an invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'Password123!' })
        .expect(400);
    });

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'existing@test.com' })
        .expect(400);
    });
  });
});
