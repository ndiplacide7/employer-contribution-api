import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, cleanDatabase, registerAndLogin } from './utils/app-setup';

describe('Declarations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let employerToken: string;
  let adminToken: string;
  let noProfileToken: string;
  let employee1Id: string;
  let employee2Id: string;
  // declaration1Id is the main one used for the submit/validate lifecycle
  let declaration1Id: string;

  // Periods: PERIOD_0 is pre-submitted in setup (for summary), PERIOD_1..3 used in tests
  const PERIOD_0 = '202512';
  const PERIOD_1 = '202601';
  const PERIOD_2 = '202602';
  const PERIOD_3 = '202603';

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await cleanDatabase(dataSource);

    // Register users
    await registerAndLogin(app, 'employer@test.com', 'Password123!', 'employer');
    adminToken = await registerAndLogin(app, 'admin@test.com', 'Password123!', 'admin');
    noProfileToken = await registerAndLogin(app, 'noprofile@test.com', 'Password123!', 'employer');

    // Create employer profile then re-login to get token with employerId
    await request(app.getHttpServer())
      .post('/employers')
      .set('Authorization', `Bearer ${await getToken(app, 'employer@test.com', 'Password123!')}`)
      .send({ name: 'Test Company', tin: 'TIN-DECL-001', sector: 'Technology' });

    employerToken = await getToken(app, 'employer@test.com', 'Password123!');

    // Create employees
    const emp1Res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        nationalId: 'NAT-DECL-001',
        name: 'Employee One',
        dateOfBirth: '1988-03-10',
        hireDate: '2020-01-15',
        grossSalary: 50000,
      });
    employee1Id = emp1Res.body.id;

    const emp2Res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        nationalId: 'NAT-DECL-002',
        name: 'Employee Two',
        dateOfBirth: '1992-07-22',
        hireDate: '2021-04-01',
        grossSalary: 80000,
      });
    employee2Id = emp2Res.body.id;

    // Pre-create and submit a declaration so the summary endpoint has non-draft data
    const setupDeclRes = await request(app.getHttpServer())
      .post('/declarations')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({
        period: PERIOD_0,
        contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
      });
    await request(app.getHttpServer())
      .patch(`/declarations/${setupDeclRes.body.id}/submit`)
      .set('Authorization', `Bearer ${employerToken}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /declarations', () => {
    it('should return 403 for admin role (employer only)', () => {
      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          period: PERIOD_1,
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        })
        .expect(403);
    });

    it('should return 403 for employer without a profile', () => {
      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${noProfileToken}`)
        .send({
          period: PERIOD_1,
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        })
        .expect(403);
    });

    it('should create a draft declaration with auto-calculated contributions', async () => {
      const grossSalary1 = 50000;
      const grossSalary2 = 80000;

      const res = await request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: PERIOD_1,
          contributions: [
            { employeeId: employee1Id, grossSalaryForPeriod: grossSalary1 },
            { employeeId: employee2Id, grossSalaryForPeriod: grossSalary2 },
          ],
        })
        .expect(201);

      declaration1Id = res.body.id;
      expect(res.body.status).toBe('draft');
      expect(res.body.period).toBe(PERIOD_1);
      expect(res.body.paymentNumber).toBeDefined();
      expect(res.body.contributions).toHaveLength(2);

      const contrib1 = res.body.contributions.find(
        (c: any) => c.employeeId === employee1Id,
      );
      expect(parseFloat(contrib1.pensionAmount)).toBeCloseTo(grossSalary1 * 0.06, 1);
      expect(parseFloat(contrib1.medicalAmount)).toBeCloseTo(grossSalary1 * 0.075, 1);
      expect(parseFloat(contrib1.maternityAmount)).toBeCloseTo(grossSalary1 * 0.003, 1);
      expect(parseFloat(contrib1.total)).toBeCloseTo(
        grossSalary1 * 0.06 + grossSalary1 * 0.075 + grossSalary1 * 0.003,
        1,
      );
    });

    it('should return 409 for a duplicate period for the same employer', () => {
      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: PERIOD_1,
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        })
        .expect(409);
    });

    it('should return 400 for an invalid period format', () => {
      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: '2024-01',
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        })
        .expect(400);
    });

    it('should return 400 for missing contributions array', () => {
      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ period: '202612' })
        .expect(400);
    });

    it('should return 400 when contributions include an employee from a different employer', async () => {
      // Register a second employer with their own employee
      const emp2Token = await registerAndLogin(app, 'employer2decl@test.com', 'Password123!', 'employer');
      await request(app.getHttpServer())
        .post('/employers')
        .set('Authorization', `Bearer ${emp2Token}`)
        .send({ name: 'Other Company', tin: 'TIN-OTHER', sector: 'Finance' });
      const emp2LoginToken = await getToken(app, 'employer2decl@test.com', 'Password123!');
      const otherEmpRes = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${emp2LoginToken}`)
        .send({ nationalId: 'NAT-OTHER-001', name: 'Other Emp', dateOfBirth: '1990-01-01', hireDate: '2021-01-01', grossSalary: 40000 });

      return request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: '202611',
          contributions: [{ employeeId: otherEmpRes.body.id, grossSalaryForPeriod: 40000 }],
        })
        .expect(400);
    });
  });

  describe('GET /declarations', () => {
    it('should return own declarations for employer', () => {
      return request(app.getHttpServer())
        .get('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.total).toBeGreaterThanOrEqual(2);
        });
    });

    it('should return all declarations for admin', () => {
      return request(app.getHttpServer())
        .get('/declarations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.total).toBeGreaterThanOrEqual(2);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/declarations?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.limit).toBe(1);
        });
    });
  });

  describe('GET /declarations/summary', () => {
    it('should return contribution summary for non-draft declarations', () => {
      // PERIOD_0 was submitted in setup, so at least 1 entry should appear
      return request(app.getHttpServer())
        .get('/declarations/summary')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          const entry = res.body[0];
          expect(entry.period).toBeDefined();
          expect(entry.totalPension).toBeDefined();
          expect(entry.totalMedical).toBeDefined();
          expect(entry.totalMaternity).toBeDefined();
          expect(entry.totalContributions).toBeDefined();
        });
    });

    it('should exclude draft declarations from the summary', () => {
      // PERIOD_1 is a draft, it should NOT appear in the summary
      return request(app.getHttpServer())
        .get('/declarations/summary')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          const periods = res.body.map((e: any) => e.period);
          expect(periods).not.toContain(PERIOD_1);
        });
    });

    it('should support startPeriod and endPeriod filters', () => {
      return request(app.getHttpServer())
        .get(`/declarations/summary?startPeriod=${PERIOD_0}&endPeriod=${PERIOD_0}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((e: any) => {
            expect(e.period >= PERIOD_0 && e.period <= PERIOD_0).toBe(true);
          });
        });
    });

    it('should return 403 for admin role (employer only)', () => {
      return request(app.getHttpServer())
        .get('/declarations/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('GET /declarations/:id', () => {
    it('should return a declaration by ID', () => {
      return request(app.getHttpServer())
        .get(`/declarations/${declaration1Id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(declaration1Id);
          expect(res.body.status).toBe('draft');
          expect(res.body.contributions).toBeDefined();
        });
    });

    it('should return 404 for a non-existent declaration', () => {
      return request(app.getHttpServer())
        .get('/declarations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(404);
    });
  });

  describe('PATCH /declarations/:id/submit', () => {
    it('should return 403 for admin role (employer only)', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should submit a draft declaration', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/submit`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('submitted');
          expect(res.body.submittedAt).toBeDefined();
        });
    });

    it('should return 400 when submitting a non-draft declaration', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/submit`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(400);
    });
  });

  describe('PATCH /declarations/:id/validate', () => {
    it('should return 403 for employer role (admin only)', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/validate`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);
    });

    it('should validate a submitted declaration', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/validate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('validated');
        });
    });

    it('should return 400 when validating a non-submitted declaration', () => {
      // declaration1Id is now validated, so validating again should fail
      return request(app.getHttpServer())
        .patch(`/declarations/${declaration1Id}/validate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('PATCH /declarations/:id/reject', () => {
    let decl2Id: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: PERIOD_2,
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        });
      decl2Id = res.body.id;

      await request(app.getHttpServer())
        .patch(`/declarations/${decl2Id}/submit`)
        .set('Authorization', `Bearer ${employerToken}`);
    });

    it('should return 403 for employer role (admin only)', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${decl2Id}/reject`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(403);
    });

    it('should reject a submitted declaration', () => {
      return request(app.getHttpServer())
        .patch(`/declarations/${decl2Id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('rejected');
        });
    });

    it('should return 400 when rejecting a non-submitted declaration', () => {
      // decl2Id is now rejected, so rejecting again should fail
      return request(app.getHttpServer())
        .patch(`/declarations/${decl2Id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('DELETE /declarations/:id', () => {
    let draftDeclId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({
          period: PERIOD_3,
          contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }],
        });
      draftDeclId = res.body.id;
    });

    it('should return 400 when deleting a validated declaration', () => {
      return request(app.getHttpServer())
        .delete(`/declarations/${declaration1Id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(400);
    });

    it('should allow deleting a rejected declaration', async () => {
      // Create, submit, then reject a new declaration to test rejection deletion
      const rejectedRes = await request(app.getHttpServer())
        .post('/declarations')
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ period: '202511', contributions: [{ employeeId: employee1Id, grossSalaryForPeriod: 50000 }] });
      await request(app.getHttpServer())
        .patch(`/declarations/${rejectedRes.body.id}/submit`)
        .set('Authorization', `Bearer ${employerToken}`);
      await request(app.getHttpServer())
        .patch(`/declarations/${rejectedRes.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);

      return request(app.getHttpServer())
        .delete(`/declarations/${rejectedRes.body.id}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);
    });

    it('should delete a draft declaration', () => {
      return request(app.getHttpServer())
        .delete(`/declarations/${draftDeclId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(`/declarations/${draftDeclId}`)
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(404);
    });
  });
});

async function getToken(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}
