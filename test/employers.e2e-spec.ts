import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, cleanDatabase, registerAndLogin } from './utils/app-setup';

describe('Employers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let employer1Token: string;
  let employer2Token: string;
  let adminToken: string;
  let employer1Id: string;
  let employer2Id: string;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await cleanDatabase(dataSource);

    employer1Token = await registerAndLogin(app, 'employer1@test.com', 'Password123!', 'employer');
    employer2Token = await registerAndLogin(app, 'employer2@test.com', 'Password123!', 'employer');
    adminToken = await registerAndLogin(app, 'admin@test.com', 'Password123!', 'admin');

    // Create employer profiles for both employer users
    const res1 = await request(app.getHttpServer())
      .post('/employers')
      .set('Authorization', `Bearer ${employer1Token}`)
      .send({ name: 'Company One Ltd', tin: 'TIN-TEST-001', sector: 'Technology' });
    employer1Id = res1.body.id;

    const res2 = await request(app.getHttpServer())
      .post('/employers')
      .set('Authorization', `Bearer ${employer2Token}`)
      .send({ name: 'Company Two Ltd', tin: 'TIN-TEST-002', sector: 'Finance' });
    employer2Id = res2.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication guard', () => {
    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/employers').expect(401);
    });

    it('should return 401 for an invalid token', () => {
      return request(app.getHttpServer())
        .get('/employers')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('POST /employers', () => {
    it('should return 409 when TIN already exists', () => {
      return request(app.getHttpServer())
        .post('/employers')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ name: 'Duplicate TIN Co', tin: 'TIN-TEST-002', sector: 'Retail' })
        .expect(409);
    });

    it('should return 409 when user already has an employer profile', () => {
      return request(app.getHttpServer())
        .post('/employers')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ name: 'Second Profile', tin: 'TIN-TEST-UNIQUE', sector: 'Retail' })
        .expect(409);
    });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/employers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Missing TIN Co' })
        .expect(400);
    });
  });

  describe('GET /employers', () => {
    it('should return 403 for employer role (admin only)', () => {
      return request(app.getHttpServer())
        .get('/employers')
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('should return all employers for admin', () => {
      return request(app.getHttpServer())
        .get('/employers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThanOrEqual(2);
          expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/employers?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.limit).toBe(1);
        });
    });
  });

  describe('GET /employers/:id', () => {
    it('should return own employer profile for employer role', () => {
      return request(app.getHttpServer())
        .get(`/employers/${employer1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(employer1Id);
          expect(res.body.tin).toBe('TIN-TEST-001');
          expect(res.body.name).toBe('Company One Ltd');
        });
    });

    it('should return 403 when employer accesses another employer profile', () => {
      return request(app.getHttpServer())
        .get(`/employers/${employer2Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('should return any employer profile for admin', () => {
      return request(app.getHttpServer())
        .get(`/employers/${employer2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(employer2Id);
        });
    });

    it('should return 404 for a non-existent employer', () => {
      return request(app.getHttpServer())
        .get('/employers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /employers/:id', () => {
    it('should update own employer profile', () => {
      return request(app.getHttpServer())
        .patch(`/employers/${employer1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ name: 'Company One Ltd Updated', sector: 'FinTech' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Company One Ltd Updated');
          expect(res.body.sector).toBe('FinTech');
        });
    });

    it('should return 403 when employer updates another employer profile', () => {
      return request(app.getHttpServer())
        .patch(`/employers/${employer2Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ name: 'Hijacked Name' })
        .expect(403);
    });

    it('should return 409 when updating to an existing TIN', () => {
      return request(app.getHttpServer())
        .patch(`/employers/${employer1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ tin: 'TIN-TEST-002' })
        .expect(409);
    });

    it('should allow admin to update any employer', () => {
      return request(app.getHttpServer())
        .patch(`/employers/${employer2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sector: 'Insurance' })
        .expect(200)
        .expect((res) => {
          expect(res.body.sector).toBe('Insurance');
        });
    });
  });

  describe('DELETE /employers/:id', () => {
    it('should return 403 for employer role (admin only)', () => {
      return request(app.getHttpServer())
        .delete(`/employers/${employer1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(403);
    });

    it('should allow admin to delete an employer', async () => {
      // Create a throwaway employer to delete
      const throwawayToken = await registerAndLogin(
        app,
        'throwaway@test.com',
        'Password123!',
        'employer',
      );
      const res = await request(app.getHttpServer())
        .post('/employers')
        .set('Authorization', `Bearer ${throwawayToken}`)
        .send({ name: 'Throwaway Co', tin: 'TIN-THROWAWAY', sector: 'Other' });

      return request(app.getHttpServer())
        .delete(`/employers/${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
