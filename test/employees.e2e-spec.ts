import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, cleanDatabase, registerAndLogin } from './utils/app-setup';

describe('Employees (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let employer1Token: string;
  let employer2Token: string;
  let adminToken: string;
  let noProfileToken: string;
  let employee1Id: string;
  let employee2Id: string;

  const employee1Data = {
    nationalId: 'NAT-TEST-001',
    name: 'Alice Smith',
    dateOfBirth: '1990-05-15',
    hireDate: '2022-01-10',
    grossSalary: 60000,
  };

  const employee2Data = {
    nationalId: 'NAT-TEST-002',
    name: 'Bob Jones',
    dateOfBirth: '1985-11-20',
    hireDate: '2021-06-01',
    grossSalary: 80000,
  };

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await cleanDatabase(dataSource);

    // Employer with profile
    employer1Token = await registerAndLogin(app, 'employer1@test.com', 'Password123!', 'employer');
    // Employer with a different profile (cross-employer access tests)
    employer2Token = await registerAndLogin(app, 'employer2@test.com', 'Password123!', 'employer');
    // Admin
    adminToken = await registerAndLogin(app, 'admin@test.com', 'Password123!', 'admin');
    // Employer without a profile
    noProfileToken = await registerAndLogin(
      app,
      'noprofile@test.com',
      'Password123!',
      'employer',
    );

    // Create employer profiles
    await request(app.getHttpServer())
      .post('/employers')
      .set('Authorization', `Bearer ${employer1Token}`)
      .send({ name: 'Company One', tin: 'TIN-E-001', sector: 'Technology' });

    await request(app.getHttpServer())
      .post('/employers')
      .set('Authorization', `Bearer ${employer2Token}`)
      .send({ name: 'Company Two', tin: 'TIN-E-002', sector: 'Finance' });

    // Re-login to get tokens with embedded employerId (the register token lacks it)
    const res1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'employer1@test.com', password: 'Password123!' });
    employer1Token = res1.body.accessToken;

    const res2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'employer2@test.com', password: 'Password123!' });
    employer2Token = res2.body.accessToken;

    // Create employees under employer1
    const emp1Res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${employer1Token}`)
      .send(employee1Data);
    employee1Id = emp1Res.body.id;

    const emp2Res = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${employer1Token}`)
      .send(employee2Data);
    employee2Id = emp2Res.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication guard', () => {
    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/employees').expect(401);
    });
  });

  describe('POST /employees', () => {
    it('should return 403 for employer without a profile', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${noProfileToken}`)
        .send({ nationalId: 'NAT-X', name: 'X', dateOfBirth: '1990-01-01', hireDate: '2020-01-01', grossSalary: 50000 })
        .expect(403);
    });

    it('should return 409 for a duplicate nationalId', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send(employee1Data)
        .expect(409);
    });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ name: 'Incomplete Employee' })
        .expect(400);
    });

    it('should return 400 for negative grossSalary', () => {
      return request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ nationalId: 'NAT-TEST-NEG', name: 'Neg Salary', dateOfBirth: '1990-01-01', hireDate: '2020-01-01', grossSalary: -1000 })
        .expect(400);
    });
  });

  describe('GET /employees', () => {
    it('should return only own employees for employer', () => {
      return request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.total).toBe(2);
          res.body.data.forEach((emp: any) => {
            expect([employee1Id, employee2Id]).toContain(emp.id);
          });
        });
    });

    it('should return no employees for employer2 (different employer)', () => {
      return request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${employer2Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.total).toBe(0);
        });
    });

    it('should return all employees for admin', () => {
      return request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.total).toBeGreaterThanOrEqual(2);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/employees?limit=1&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.limit).toBe(1);
        });
    });
  });

  describe('GET /employees/:id', () => {
    it('should return an employee by ID for the owning employer', () => {
      return request(app.getHttpServer())
        .get(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(employee1Id);
          expect(res.body.nationalId).toBe(employee1Data.nationalId);
          expect(res.body.name).toBe(employee1Data.name);
        });
    });

    it('should return 404 when employer accesses another employer employee', () => {
      // The service filters by employerId, so the employee is simply not found (404)
      return request(app.getHttpServer())
        .get(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .expect(404);
    });

    it('should return any employee for admin', () => {
      return request(app.getHttpServer())
        .get(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(employee1Id);
        });
    });

    it('should return 404 for a non-existent employee', () => {
      return request(app.getHttpServer())
        .get('/employees/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PATCH /employees/:id', () => {
    it('should update an employee', () => {
      return request(app.getHttpServer())
        .patch(`/employees/${employee2Id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({ grossSalary: 90000 })
        .expect(200)
        .expect((res) => {
          expect(parseFloat(res.body.grossSalary)).toBe(90000);
        });
    });

    it('should return 404 when employer updates another employer employee', () => {
      // The service filters by employerId, so the employee is simply not found (404)
      return request(app.getHttpServer())
        .patch(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .send({ grossSalary: 1 })
        .expect(404);
    });
  });

  describe('DELETE /employees/:id', () => {
    it('should return 404 when employer deletes another employer employee', () => {
      // The service filters by employerId, so the employee is simply not found (404)
      return request(app.getHttpServer())
        .delete(`/employees/${employee1Id}`)
        .set('Authorization', `Bearer ${employer2Token}`)
        .expect(404);
    });

    it('should delete an employee', async () => {
      // Create a throwaway employee to delete
      const res = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${employer1Token}`)
        .send({
          nationalId: 'NAT-DELETE-ME',
          name: 'Delete Me',
          dateOfBirth: '1995-01-01',
          hireDate: '2023-01-01',
          grossSalary: 40000,
        });

      return request(app.getHttpServer())
        .delete(`/employees/${res.body.id}`)
        .set('Authorization', `Bearer ${employer1Token}`)
        .expect(200);
    });
  });
});
