import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { dataSource } from '../../config/database.config';
import { User } from '../../entities/user.entity';
import { Employer } from '../../entities/employer.entity';
import { Employee } from '../../entities/employee.entity';
import { Declaration } from '../../entities/declaration.entity';
import { ContributionLine } from '../../entities/contribution-line.entity';
import { UserRole, EmployerStatus, DeclarationStatus } from '../../common/enums';

async function seed() {
  try {
    await dataSource.initialize();
    console.log('Database connection established');

    // Clear existing data (in correct order to handle foreign keys)
    await dataSource.query('TRUNCATE TABLE contribution_lines CASCADE');
    await dataSource.query('TRUNCATE TABLE declarations CASCADE');
    await dataSource.query('TRUNCATE TABLE employees CASCADE');
    await dataSource.query('TRUNCATE TABLE employers CASCADE');
    await dataSource.query('TRUNCATE TABLE users CASCADE');

    console.log('Existing data cleared');

    // Create admin user
    const adminUser = dataSource.getRepository(User).create({
      email: 'admin@example.com',
      password: await bcrypt.hash('Admin123!', 10),
      role: UserRole.ADMIN,
    });
    await dataSource.getRepository(User).save(adminUser);
    console.log('Admin user created: admin@example.com / Admin123!');

    // Create employer users and profiles
    const employers = [];
    for (let i = 1; i <= 3; i++) {
      const employerUser = dataSource.getRepository(User).create({
        email: `employer${i}@example.com`,
        password: await bcrypt.hash('Employer123!', 10),
        role: UserRole.EMPLOYER,
      });
      await dataSource.getRepository(User).save(employerUser);

      const employer = dataSource.getRepository(Employer).create({
        name: `Company ${i} Ltd`,
        tin: `TIN${String(i).padStart(9, '0')}`,
        sector: ['Technology', 'Finance', 'Healthcare'][i - 1],
        status: EmployerStatus.ACTIVE,
        userId: employerUser.id,
      });
      await dataSource.getRepository(Employer).save(employer);
      employers.push(employer);

      console.log(
        `Employer ${i} created: employer${i}@example.com / Employer123!`,
      );
    }

    // Create employees for each employer
    for (const employer of employers) {
      const employees = [];
      for (let i = 1; i <= 5; i++) {
        const employee = dataSource.getRepository(Employee).create({
          nationalId: `NAT${employer.tin.slice(-3)}${String(i).padStart(6, '0')}`,
          name: `Employee ${i} (${employer.name})`,
          dateOfBirth: new Date(1980 + i, i, 15),
          hireDate: new Date(2020, i, 1),
          grossSalary: 40000 + i * 10000,
          employerId: employer.id,
        });
        await dataSource.getRepository(Employee).save(employee);
        employees.push(employee);
      }

      console.log(`Created ${employees.length} employees for ${employer.name}`);

      // Create declarations for the last 3 months
      const currentDate = new Date();
      for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
        const declarationDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - monthOffset,
          1,
        );
        const period = `${declarationDate.getFullYear()}${String(
          declarationDate.getMonth() + 1,
        ).padStart(2, '0')}`;

        const declaration = dataSource.getRepository(Declaration).create({
          employerId: employer.id,
          period,
          status:
            monthOffset === 0
              ? DeclarationStatus.DRAFT
              : monthOffset === 1
              ? DeclarationStatus.SUBMITTED
              : DeclarationStatus.VALIDATED,
          submittedAt: monthOffset === 0 ? null : declarationDate,
        });
        await dataSource.getRepository(Declaration).save(declaration);

        // Create contribution lines
        for (const employee of employees) {
          const contribution = dataSource
            .getRepository(ContributionLine)
            .create({
              declarationId: declaration.id,
              employeeId: employee.id,
              grossSalaryForPeriod: employee.grossSalary,
            });
          await dataSource.getRepository(ContributionLine).save(contribution);
        }

        console.log(
          `Created declaration for ${employer.name} - ${period} (${declaration.status})`,
        );
      }
    }

    console.log('\n=== Seed completed successfully ===');
    console.log('\nTest Accounts:');
    console.log('Admin: admin@example.com / Admin123!');
    console.log('Employer 1: employer1@example.com / Employer123!');
    console.log('Employer 2: employer2@example.com / Employer123!');
    console.log('Employer 3: employer3@example.com / Employer123!');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seed();
