import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../../src/auth/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../../src/auth/decorators/public.decorator';

const mockReflector = { getAllAndOverride: jest.fn() };

const createMockContext = (): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as any;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(mockReflector as unknown as Reflector);
  });

  it('should allow access when the route is marked @Public()', () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.any(Array),
    );
  });

  it('should delegate to JWT strategy when the route is not @Public()', () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(superCanActivate).toHaveBeenCalled();
    superCanActivate.mockRestore();
  });
});
