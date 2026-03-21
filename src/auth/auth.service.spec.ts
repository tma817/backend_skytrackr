import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUser = {
  _id: 'user-id-123',
  email: 'test@example.com',
  password: 'hashed-password',
  fname: 'John',
  lname: 'Doe',
  isVerified: true,
  otpCode: '123456',
  otpExpires: new Date(Date.now() + 10 * 60 * 1000),
  toObject: jest.fn().mockReturnValue({
    _id: 'user-id-123',
    email: 'test@example.com',
    fname: 'John',
    lname: 'Doe',
    password: 'hashed-password',
  }),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            verifyUser: jest.fn(),
            updatePassword: jest.fn(),
            updateOtp: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendOtpEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
  });

  // ─── signIn ────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('should return an access token for valid credentials', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const result = await service.signIn('test@example.com', 'password123');

      expect(result).toEqual({ access_token: 'jwt-token' });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser._id,
        email: mockUser.email,
      });
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      usersService.findOne.mockResolvedValue(null);

      await expect(service.signIn('no@user.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.signIn('test@example.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      usersService.findOne.mockResolvedValue({ ...mockUser, isVerified: false } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.signIn('test@example.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should create a new user and send OTP email', async () => {
      usersService.findOne.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser as any);
      mailService.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.register('John', 'Doe', 'test@example.com', 'pass123');

      expect(usersService.create).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);

      await expect(
        service.register('John', 'Doe', 'test@example.com', 'pass'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify email with valid OTP', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);
      usersService.verifyUser.mockResolvedValue(undefined);

      const result = await service.verifyEmail('test@example.com', '123456');

      expect(usersService.verifyUser).toHaveBeenCalledWith('test@example.com');
      expect(result.message).toContain('Successfully');
    });

    it('should throw UnauthorizedException for wrong OTP', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);

      await expect(service.verifyEmail('test@example.com', '999999')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired OTP', async () => {
      usersService.findOne.mockResolvedValue({
        ...mockUser,
        otpCode: '123456',
        otpExpires: new Date(Date.now() - 1000), // already expired
      } as any);

      await expect(service.verifyEmail('test@example.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      usersService.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('no@user.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should return safe message even when user does not exist', async () => {
      usersService.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('no@user.com');

      expect(result.message).toContain('If that email exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user exists', async () => {
      usersService.findOne.mockResolvedValue(mockUser as any);
      jwtService.signAsync.mockResolvedValue('reset-token');
      mailService.sendPasswordResetEmail.mockResolvedValue(undefined);
      process.env.FRONTEND_URL = 'http://localhost:3000';

      const result = await service.forgotPassword('test@example.com');

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(result.message).toContain('If that email exists');
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        email: 'test@example.com',
        type: 'password_reset',
      });
      usersService.updatePassword.mockResolvedValue(undefined);

      const result = await service.resetPassword('valid-token', 'newpassword');

      expect(usersService.updatePassword).toHaveBeenCalledWith('test@example.com', 'newpassword');
      expect(result.message).toContain('Password updated');
    });

    it('should throw BadRequestException for invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.resetPassword('bad-token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token type is wrong', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        email: 'test@example.com',
        type: 'login', // wrong type
      });

      await expect(service.resetPassword('token', 'newpass')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── resendOtp ─────────────────────────────────────────────────────────────

  describe('resendOtp', () => {
    it('should resend OTP for unverified user', async () => {
      usersService.findOne.mockResolvedValue({ ...mockUser, isVerified: false } as any);
      usersService.updateOtp.mockResolvedValue(undefined);
      mailService.sendOtpEmail.mockResolvedValue(undefined);

      const result = await service.resendOtp('test@example.com');

      expect(usersService.updateOtp).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalled();
      expect(result.message).toContain('new code');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      usersService.findOne.mockResolvedValue(null);

      await expect(service.resendOtp('no@user.com')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when user is already verified', async () => {
      usersService.findOne.mockResolvedValue({ ...mockUser, isVerified: true } as any);

      await expect(service.resendOtp('test@example.com')).rejects.toThrow(BadRequestException);
    });
  });
});
