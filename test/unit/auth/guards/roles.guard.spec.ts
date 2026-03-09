import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../../src/auth/guards/roles.guard';
import { UserRole } from '../../../../src/common/enums';

const mockReflector = { getAllAndOverride: jest.fn() };

const createMockContext = (user: any): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  it('should allow access when no roles metadata is set', () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    expect(guard.canActivate(createMockContext({ role: UserRole.EMPLOYER }))).toBe(true);
  });

  it('should allow access when user role matches a required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.EMPLOYER]);
    expect(guard.canActivate(createMockContext({ role: UserRole.EMPLOYER }))).toBe(true);
  });

  it('should allow access when user is admin and admin role is required', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createMockContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('should allow access when multiple roles are required and user matches one', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.EMPLOYER, UserRole.ADMIN]);
    expect(guard.canActivate(createMockContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('should deny access when user role does not match any required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createMockContext({ role: UserRole.EMPLOYER }))).toBe(false);
  });

  it('should deny access when user is null', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createMockContext(null))).toBe(false);
  });

  it('should deny access when user has no role property', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createMockContext({}))).toBe(false);
  });
});
