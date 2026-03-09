import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployeesService } from '../../../src/employees/employees.service';
import { Employee } from '../../../src/entities/employee.entity';
import { UserRole } from '../../../src/common/enums';

const buildQb = (getOneResult?: any, getManyAndCountResult?: any) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(getOneResult ?? null),
  getManyAndCount: jest.fn().mockResolvedValue(getManyAndCountResult ?? [[], 0]),
});

const mockEmployeeRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('EmployeesService', () => {
  let service: EmployeesService;
  let employeeRepo: ReturnType<typeof mockEmployeeRepo>;

  const mockEmployee: Partial<Employee> = {
    id: 'emp-uuid',
    nationalId: 'NAT-001',
    name: 'Alice',
    employerId: 'employer-uuid',
    grossSalary: 60000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(Employee), useFactory: mockEmployeeRepo },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    employeeRepo = module.get(getRepositoryToken(Employee));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      nationalId: 'NAT-001',
      name: 'Alice',
      dateOfBirth: '1990-01-01',
      hireDate: '2020-01-01',
      grossSalary: 60000,
    };

    it('should create and return a new employee', async () => {
      employeeRepo.findOne.mockResolvedValue(null);
      employeeRepo.create.mockReturnValue(mockEmployee);
      employeeRepo.save.mockResolvedValue(mockEmployee);

      const result = await service.create(dto, 'employer-uuid');
      expect(result).toEqual(mockEmployee);
      expect(employeeRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when national ID already exists', async () => {
      employeeRepo.findOne.mockResolvedValue(mockEmployee);
      await expect(service.create(dto, 'employer-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all employees when no employerId filter is applied (admin)', async () => {
      const qb = buildQb(null, [[mockEmployee], 1]);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ offset: 0, limit: 10 });

      expect(result.total).toBe(1);
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('should filter by employerId when provided (employer scope)', async () => {
      const qb = buildQb(null, [[mockEmployee], 1]);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ offset: 0, limit: 10 }, 'employer-uuid');

      expect(qb.where).toHaveBeenCalledWith(
        'employee.employerId = :employerId',
        { employerId: 'employer-uuid' },
      );
    });

    it('should apply offset and limit via skip/take', async () => {
      const qb = buildQb(null, [[], 0]);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ offset: 5, limit: 2 });

      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(2);
    });
  });

  describe('findOne', () => {
    it('should return an employee when found', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('emp-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(result).toEqual(mockEmployee);
    });

    it('should filter by employerId for employer role', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findOne('emp-uuid', 'employer-uuid', UserRole.EMPLOYER);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'employee.employerId = :employerId',
        { employerId: 'employer-uuid' },
      );
    });

    it('should NOT filter by employerId for admin role', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findOne('emp-uuid', undefined, UserRole.ADMIN);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee is not found', async () => {
      const qb = buildQb(null);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findOne('bad-uuid', 'employer-uuid', UserRole.EMPLOYER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the employee', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);
      const updated = { ...mockEmployee, grossSalary: 70000 };
      employeeRepo.save.mockResolvedValue(updated);

      const result = await service.update('emp-uuid', { grossSalary: 70000 }, 'employer-uuid', UserRole.EMPLOYER);
      expect(parseFloat(result.grossSalary as any)).toBe(70000);
    });

    it('should throw ConflictException when updating to an existing national ID', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);
      employeeRepo.findOne.mockResolvedValue({ ...mockEmployee, id: 'other-emp' }); // nationalId conflict

      await expect(
        service.update('emp-uuid', { nationalId: 'NAT-002' }, 'employer-uuid', UserRole.EMPLOYER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove the employee', async () => {
      const qb = buildQb(mockEmployee);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);
      employeeRepo.remove.mockResolvedValue(undefined);

      await service.remove('emp-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(employeeRepo.remove).toHaveBeenCalledWith(mockEmployee);
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      const qb = buildQb(null);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.remove('bad-uuid', 'employer-uuid', UserRole.EMPLOYER)).rejects.toThrow(NotFoundException);
    });
  });
});
