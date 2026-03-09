import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1709467200000 implements MigrationInterface {
  name = 'InitialMigration1709467200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('employer', 'admin');

      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'employer',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );

      CREATE INDEX "IDX_users_email" ON "users"("email");
    `);

    // Create employers table
    await queryRunner.query(`
      CREATE TYPE "employer_status_enum" AS ENUM('active', 'suspended');

      CREATE TABLE "employers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "tin" varchar NOT NULL UNIQUE,
        "sector" varchar NOT NULL,
        "registrationDate" TIMESTAMP NOT NULL DEFAULT now(),
        "status" "employer_status_enum" NOT NULL DEFAULT 'active',
        "userId" uuid NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_employer_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );

      CREATE INDEX "IDX_employers_tin" ON "employers"("tin");
    `);

    // Create employees table
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "nationalId" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "dateOfBirth" date NOT NULL,
        "hireDate" date NOT NULL,
        "grossSalary" decimal(10,2) NOT NULL,
        "employerId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_employee_employer" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE
      );

      CREATE INDEX "IDX_employees_nationalId" ON "employees"("nationalId");
      CREATE INDEX "IDX_employees_employerId" ON "employees"("employerId");
    `);

    // Create declarations table
    await queryRunner.query(`
      CREATE TYPE "declaration_status_enum" AS ENUM('draft', 'submitted', 'validated', 'rejected');

      CREATE TABLE "declarations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "paymentNumber" varchar NOT NULL UNIQUE,
        "employerId" uuid NOT NULL,
        "period" varchar(6) NOT NULL,
        "status" "declaration_status_enum" NOT NULL DEFAULT 'draft',
        "submittedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_declaration_employer" FOREIGN KEY ("employerId") REFERENCES "employers"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_employer_period" UNIQUE ("employerId", "period")
      );

      CREATE INDEX "IDX_declarations_employerId" ON "declarations"("employerId");
      CREATE INDEX "IDX_declarations_period" ON "declarations"("period");
    `);

    // Create contribution_lines table
    await queryRunner.query(`
      CREATE TABLE "contribution_lines" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "employeeId" uuid NOT NULL,
        "declarationId" uuid NOT NULL,
        "grossSalaryForPeriod" decimal(10,2) NOT NULL,
        "pensionAmount" decimal(10,2) NOT NULL,
        "medicalAmount" decimal(10,2) NOT NULL,
        "maternityAmount" decimal(10,2) NOT NULL,
        "total" decimal(10,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_contribution_employee" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contribution_declaration" FOREIGN KEY ("declarationId") REFERENCES "declarations"("id") ON DELETE CASCADE
      );
    `);

    // Enable uuid extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "contribution_lines"`);
    await queryRunner.query(`DROP TABLE "declarations"`);
    await queryRunner.query(`DROP TYPE "declaration_status_enum"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TABLE "employers"`);
    await queryRunner.query(`DROP TYPE "employer_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
