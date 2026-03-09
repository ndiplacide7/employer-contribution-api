import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/auth/auth.service';
import { User } from '../../../src/entities/user.entity';
import { UserRole } from '../../../src/common/enums';

jest.mock('bcrypt');

const mockUserRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockJwtService = { sign: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepository>;

  const existingUser = {
    id: 'user-uuid',
    email: 'test@example.com',
    password: 'hashed_pw',
    role: UserRole.EMPLOYER,
    employer: { id: 'employer-uuid' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('signed_token');
  });

  describe('register', () => {
    const dto = { email: 'new@example.com', password: 'Password123!', role: UserRole.EMPLOYER };

    it('should hash the password and return an access token', async () => {
      userRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pw');
      userRepo.create.mockReturnValue({ id: 'new-uuid', ...dto, password: 'hashed_pw' });
      userRepo.save.mockResolvedValue({ id: 'new-uuid', email: dto.email, role: dto.role });

      const result = await service.register(dto);

      expect(result).toEqual({ accessToken: 'signed_token' });
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(userRepo.save).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should check email uniqueness before hashing', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      try {
        await service.register(dto);
      } catch {}
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'Password123!' };

    it('should return an access token for valid credentials', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result).toEqual({ accessToken: 'signed_token' });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, existingUser.password);
    });

    it('should include employerId in the JWT payload when user has an employer profile', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(dto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ employerId: 'employer-uuid' }),
      );
    });

    it('should not include employerId when user has no employer profile', async () => {
      userRepo.findOne.mockResolvedValue({ ...existingUser, employer: null });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(dto);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ employerId: undefined }),
      );
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should fetch the user with their employer relation for login', async () => {
      userRepo.findOne.mockResolvedValue(existingUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await service.login(dto);
      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['employer'] }),
      );
    });
  });
});
