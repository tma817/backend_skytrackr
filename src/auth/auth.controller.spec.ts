import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  signIn: jest.fn(),
  register: jest.fn(),
  verifyEmail: jest.fn(),
  resendOtp: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signIn', () => {
    it('should call authService.signIn and return access token', async () => {
      mockAuthService.signIn.mockResolvedValue({ access_token: 'jwt-token' });

      const result = await controller.signIn({ email: 'test@example.com', password: 'pass123' });

      expect(mockAuthService.signIn).toHaveBeenCalledWith('test@example.com', 'pass123');
      expect(result).toEqual({ access_token: 'jwt-token' });
    });
  });

  describe('register', () => {
    it('should call authService.register with correct fields', async () => {
      const dto = { fname: 'John', lname: 'Doe', email: 'j@example.com', password: 'pass123' };
      mockAuthService.register.mockResolvedValue({ _id: 'id', email: dto.email });

      const result = await controller.register(dto as any);

      expect(mockAuthService.register).toHaveBeenCalledWith('John', 'Doe', 'j@example.com', 'pass123');
      expect(result).toHaveProperty('email', dto.email);
    });
  });

  describe('verify', () => {
    it('should call authService.verifyEmail', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({ message: 'Successfully verification, you can login right now' });

      const result = await controller.verify({ email: 'test@example.com', otpCode: '123456' });

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('test@example.com', '123456');
      expect(result.message).toContain('Successfully');
    });
  });

  describe('resendOtp', () => {
    it('should call authService.resendOtp', async () => {
      mockAuthService.resendOtp.mockResolvedValue({ message: 'A new code has been sent to your email.' });

      const result = await controller.resendOtp('test@example.com');

      expect(mockAuthService.resendOtp).toHaveBeenCalledWith('test@example.com');
      expect(result.message).toContain('new code');
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'If that email exists, a reset link has been sent.' });

      const result = await controller.forgotPassword({ email: 'test@example.com' });

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(result.message).toContain('If that email exists');
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      mockAuthService.resetPassword.mockResolvedValue({ message: 'Password updated successfully. You can now log in.' });

      const result = await controller.resetPassword({ token: 'tok', newPassword: 'newpass' });

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('tok', 'newpass');
      expect(result.message).toContain('Password updated');
    });
  });
});
