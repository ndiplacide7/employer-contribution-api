import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeclarationsService } from '../../../src/declarations/declarations.service';
import { Declaration } from '../../../src/entities/declaration.entity';
import { ContributionLine } from '../../../src/entities/contribution-line.entity';
import { Employee } from '../../../src/entities/employee.entity';
import { DeclarationStatus, UserRole } from '../../../src/common/enums';

const buildQb = (opts: {
  getOne?: any;
  getManyAndCount?: any;
  getRawMany?: any;
} = {}) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(opts.getOne ?? null),
  getManyAndCount: jest.fn().mockResolvedValue(opts.getManyAndCount ?? [[], 0]),
  getRawMany: jest.fn().mockResolvedValue(opts.getRawMany ?? []),
});

const mockDeclarationRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockContributionRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockEmployeeRepo = () => ({
  find: jest.fn(),
});

describe('DeclarationsService', () => {
  let service: DeclarationsService;
  let declarationRepo: ReturnType<typeof mockDeclarationRepo>;
  let contributionRepo: ReturnType<typeof mockContributionRepo>;
  let employeeRepo: ReturnType<typeof mockEmployeeRepo>;

  const mockDeclaration: Partial<Declaration> = {
    id: 'decl-uuid',
    period: '202601',
    employerId: 'employer-uuid',
    status: DeclarationStatus.DRAFT,
    paymentNumber: 'PAY-123-0001',
    contributions: [],
  };

  const mockEmployee: Partial<Employee> = {
    id: 'emp-uuid',
    name: 'Alice',
    employerId: 'employer-uuid',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeclarationsService,
        { provide: getRepositoryToken(Declaration), useFactory: mockDeclarationRepo },
        { provide: getRepositoryToken(ContributionLine), useFactory: mockContributionRepo },
        { provide: getRepositoryToken(Employee), useFactory: mockEmployeeRepo },
      ],
    }).compile();

    service = module.get<DeclarationsService>(DeclarationsService);
    declarationRepo = module.get(getRepositoryToken(Declaration));
    contributionRepo = module.get(getRepositoryToken(ContributionLine));
    employeeRepo = module.get(getRepositoryToken(Employee));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      period: '202601',
      contributions: [{ employeeId: 'emp-uuid', grossSalaryForPeriod: 50000 }],
    };

    it('should create a draft declaration with contributions', async () => {
      declarationRepo.findOne
        .mockResolvedValueOnce(null)           // duplicate period check
        .mockResolvedValueOnce(mockDeclaration); // refetch with relations
      employeeRepo.find.mockResolvedValue([mockEmployee]);
      declarationRepo.create.mockReturnValue(mockDeclaration);
      declarationRepo.save.mockResolvedValue(mockDeclaration);
      contributionRepo.create.mockReturnValue({});
      contributionRepo.save.mockResolvedValue([{}]);

      const result = await service.create(dto, 'employer-uuid');
      expect(result).toEqual(mockDeclaration);
      expect(declarationRepo.save).toHaveBeenCalled();
      expect(contributionRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException when a declaration for the period already exists', async () => {
      declarationRepo.findOne.mockResolvedValue(mockDeclaration);
      await expect(service.create(dto, 'employer-uuid')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when some employees do not belong to the employer', async () => {
      declarationRepo.findOne.mockResolvedValue(null);
      employeeRepo.find.mockResolvedValue([]); // 0 matching employees, but 1 requested
      await expect(service.create(dto, 'employer-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return a paginated list without employer filter for admin', async () => {
      const qb = buildQb({ getManyAndCount: [[mockDeclaration], 1] });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ offset: 0, limit: 10 });

      expect(result.total).toBe(1);
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('should filter by employerId for employer scope', async () => {
      const qb = buildQb({ getManyAndCount: [[mockDeclaration], 1] });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ offset: 0, limit: 10 }, 'employer-uuid');

      expect(qb.where).toHaveBeenCalledWith(
        'declaration.employerId = :employerId',
        { employerId: 'employer-uuid' },
      );
    });
  });

  describe('findOne', () => {
    it('should return a declaration when found', async () => {
      const qb = buildQb({ getOne: mockDeclaration });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOne('decl-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(result).toEqual(mockDeclaration);
    });

    it('should throw NotFoundException when declaration does not exist', async () => {
      const qb = buildQb({ getOne: null });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should filter by employerId for employer role', async () => {
      const qb = buildQb({ getOne: mockDeclaration });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findOne('decl-uuid', 'employer-uuid', UserRole.EMPLOYER);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'declaration.employerId = :employerId',
        { employerId: 'employer-uuid' },
      );
    });
  });

  describe('submit', () => {
    it('should change status from DRAFT to SUBMITTED and set submittedAt', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.DRAFT } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);
      declarationRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.submit('decl-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(result.status).toBe(DeclarationStatus.SUBMITTED);
      expect(result.submittedAt).toBeDefined();
    });

    it('should throw BadRequestException when declaration is not in DRAFT status', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.SUBMITTED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.submit('decl-uuid', 'employer-uuid', UserRole.EMPLOYER)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validate', () => {
    it('should change status from SUBMITTED to VALIDATED', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.SUBMITTED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);
      declarationRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.validate('decl-uuid');
      expect(result.status).toBe(DeclarationStatus.VALIDATED);
    });

    it('should throw BadRequestException when declaration is not SUBMITTED', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.DRAFT } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.validate('decl-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should change status from SUBMITTED to REJECTED', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.SUBMITTED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);
      declarationRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.reject('decl-uuid');
      expect(result.status).toBe(DeclarationStatus.REJECTED);
    });

    it('should throw BadRequestException when declaration is not SUBMITTED', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.VALIDATED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.reject('decl-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a DRAFT declaration', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.DRAFT } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);
      declarationRepo.remove.mockResolvedValue(undefined);

      await service.remove('decl-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(declarationRepo.remove).toHaveBeenCalled();
    });

    it('should remove a REJECTED declaration', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.REJECTED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);
      declarationRepo.remove.mockResolvedValue(undefined);

      await service.remove('decl-uuid', 'employer-uuid', UserRole.EMPLOYER);
      expect(declarationRepo.remove).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to delete a SUBMITTED declaration', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.SUBMITTED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.remove('decl-uuid', 'employer-uuid', UserRole.EMPLOYER)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to delete a VALIDATED declaration', async () => {
      const qb = buildQb({ getOne: { ...mockDeclaration, status: DeclarationStatus.VALIDATED } });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.remove('decl-uuid', 'employer-uuid', UserRole.EMPLOYER)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getContributionSummary', () => {
    it('should return formatted contribution summary', async () => {
      const rawResult = [
        {
          period: '202601',
          totalPension: '3000.00',
          totalMedical: '3750.00',
          totalMaternity: '150.00',
          totalContributions: '6900.00',
          employeeCount: '2',
        },
      ];
      const qb = buildQb({ getRawMany: rawResult });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getContributionSummary('employer-uuid', {});

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('202601');
      expect(result[0].totalPension).toBe(3000);
      expect(result[0].totalMedical).toBe(3750);
      expect(result[0].totalMaternity).toBe(150);
      expect(result[0].totalContributions).toBe(6900);
      expect(result[0].employeeCount).toBe(2);
    });

    it('should return an empty array when no non-draft declarations exist', async () => {
      const qb = buildQb({ getRawMany: [] });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getContributionSummary('employer-uuid', {});
      expect(result).toEqual([]);
    });

    it('should apply startPeriod and endPeriod filters when provided', async () => {
      const qb = buildQb({ getRawMany: [] });
      declarationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getContributionSummary('employer-uuid', {
        startPeriod: '202601',
        endPeriod: '202612',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'declaration.period >= :startPeriod',
        { startPeriod: '202601' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'declaration.period <= :endPeriod',
        { endPeriod: '202612' },
      );
    });
  });
});
