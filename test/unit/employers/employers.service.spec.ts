import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployersService } from '../../../src/employers/employers.service';
import { Employer } from '../../../src/entities/employer.entity';
import { User } from '../../../src/entities/user.entity';
import { UserRole, EmployerStatus } from '../../../src/common/enums';

const mockEmployerRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

const mockUserRepo = () => ({ findOne: jest.fn() });

describe('EmployersService', () => {
  let service: EmployersService;
  let employerRepo: ReturnType<typeof mockEmployerRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  const mockEmployer: Partial<Employer> = {
    id: 'emp-uuid',
    name: 'Test Co',
    tin: 'TIN-001',
    sector: 'Tech',
    userId: 'user-uuid',
    status: EmployerStatus.ACTIVE,
  };

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    employer: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployersService,
        { provide: getRepositoryToken(Employer), useFactory: mockEmployerRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get<EmployersService>(EmployersService);
    employerRepo = module.get(getRepositoryToken(Employer));
    userRepo = module.get(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { name: 'Test Co', tin: 'TIN-001', sector: 'Tech' };

    it('should create and return a new employer profile', async () => {
      employerRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue({ ...mockUser, employer: null });
      employerRepo.create.mockReturnValue(mockEmployer);
      employerRepo.save.mockResolvedValue(mockEmployer);

      const result = await service.create(dto, 'user-uuid');
      expect(result).toEqual(mockEmployer);
      expect(employerRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if the TIN already exists', async () => {
      employerRepo.findOne.mockResolvedValue(mockEmployer);
      await expect(service.create(dto, 'user-uuid')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if the user already has an employer profile', async () => {
      employerRepo.findOne.mockResolvedValue(null); // TIN check passes
      userRepo.findOne.mockResolvedValue({ ...mockUser, employer: mockEmployer });
      await expect(service.create(dto, 'user-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of employers', async () => {
      employerRepo.findAndCount.mockResolvedValue([[mockEmployer], 1]);

      const result = await service.findAll({ offset: 0, limit: 10 });

      expect(result.data).toEqual([mockEmployer]);
      expect(result.total).toBe(1);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(10);
    });

    it('should respect offset and limit', async () => {
      employerRepo.findAndCount.mockResolvedValue([[], 5]);

      await service.findAll({ offset: 2, limit: 2 });

      expect(employerRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 2, take: 2 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an employer when found', async () => {
      employerRepo.findOne.mockResolvedValue(mockEmployer);

      const result = await service.findOne('emp-uuid', 'user-uuid', UserRole.EMPLOYER);
      expect(result).toEqual(mockEmployer);
    });

    it('should throw NotFoundException when employer does not exist', async () => {
      employerRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid', 'user-uuid', UserRole.EMPLOYER)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when employer accesses another employer profile', async () => {
      employerRepo.findOne.mockResolvedValue({ ...mockEmployer, userId: 'other-user' });
      await expect(service.findOne('emp-uuid', 'user-uuid', UserRole.EMPLOYER)).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any employer profile', async () => {
      employerRepo.findOne.mockResolvedValue({ ...mockEmployer, userId: 'other-user' });
      const result = await service.findOne('emp-uuid', 'admin-uuid', UserRole.ADMIN);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update and return the employer', async () => {
      const updated = { ...mockEmployer, name: 'Updated Co' };
      employerRepo.findOne.mockResolvedValue(mockEmployer);
      employerRepo.save.mockResolvedValue(updated);

      const result = await service.update('emp-uuid', { name: 'Updated Co' }, 'user-uuid', UserRole.EMPLOYER);
      expect(result.name).toBe('Updated Co');
    });

    it('should throw ConflictException when updating to a TIN that already belongs to another employer', async () => {
      employerRepo.findOne
        .mockResolvedValueOnce(mockEmployer)               // findOne in findOne()
        .mockResolvedValueOnce({ ...mockEmployer, id: 'other-emp' }); // TIN conflict check

      await expect(
        service.update('emp-uuid', { tin: 'TIN-002' }, 'user-uuid', UserRole.EMPLOYER),
      ).rejects.toThrow(ConflictException);
    });

    it('should not check TIN uniqueness when TIN is not being changed', async () => {
      employerRepo.findOne.mockResolvedValue(mockEmployer);
      employerRepo.save.mockResolvedValue(mockEmployer);

      await service.update('emp-uuid', { sector: 'Finance' }, 'user-uuid', UserRole.EMPLOYER);
      // findOne called only once (for findOne itself, not TIN check)
      expect(employerRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should remove the employer', async () => {
      employerRepo.findOne.mockResolvedValue(mockEmployer);
      employerRepo.remove.mockResolvedValue(undefined);

      await service.remove('emp-uuid', 'user-uuid', UserRole.ADMIN);
      expect(employerRepo.remove).toHaveBeenCalledWith(mockEmployer);
    });

    it('should throw NotFoundException when the employer does not exist', async () => {
      employerRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid', 'user-uuid', UserRole.ADMIN)).rejects.toThrow(NotFoundException);
    });
  });
});
