import { AuthGuard } from './auth.guard';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

const mockJwtService = { verifyAsync: jest.fn() };

function makeContext(authHeader?: string) {
  const request: any = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as any;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AuthGuard(mockJwtService as unknown as JwtService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException when no Authorization header is present', async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when scheme is not Bearer', async () => {
    await expect(guard.canActivate(makeContext('Basic some-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when token is missing after Bearer', async () => {
    await expect(guard.canActivate(makeContext('Bearer'))).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(makeContext('Bearer bad-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return true and attach payload to request for a valid token', async () => {
    const payload = { sub: 'user-id', email: 'test@example.com' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const ctx = makeContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(ctx._request['user']).toEqual(payload);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
  });
});
