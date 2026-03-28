import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

const mockUserData = {
  _id: 'user-id-123',
  fname: 'John',
  lname: 'Doe',
  email: 'test@example.com',
  password: 'hashed-password',
  isVerified: false,
  otpCode: '123456',
  otpExpires: new Date(),
};

const mockUserModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  save: jest.fn(),
};

// Constructor mock for `new this.userModel(userData)`
function MockUserModelConstructor(data: any) {
  return { ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 'new-id' }) };
}
Object.assign(MockUserModelConstructor, mockUserModel);

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: MockUserModelConstructor,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return user when found', async () => {
      mockUserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockUserData) });

      const result = await service.findOne('test@example.com');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual(mockUserData);
    });

    it('should return null when user is not found', async () => {
      mockUserModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.findOne('missing@example.com');

      expect(result).toBeNull();
    });
  });

  // ─── hashPassword ──────────────────────────────────────────────────────────

  describe('hashPassword', () => {
    it('should return a bcrypt hash different from the original password', async () => {
      const hash = await service.hashPassword('mypassword');

      expect(hash).not.toBe('mypassword');
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should produce a valid bcrypt hash that matches the original', async () => {
      const password = 'securePass123';
      const hash = await service.hashPassword(password);
      const isMatch = await bcrypt.compare(password, hash);

      expect(isMatch).toBe(true);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should hash password before saving', async () => {
      const spy = jest.spyOn(service, 'hashPassword').mockResolvedValue('hashed!');

      await service.create({ email: 'new@example.com', password: 'plaintext' });

      expect(spy).toHaveBeenCalledWith('plaintext');
    });

    it('should not call hashPassword when no password is provided', async () => {
      const spy = jest.spyOn(service, 'hashPassword');

      await service.create({ email: 'nopass@example.com' });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── verifyUser ────────────────────────────────────────────────────────────

  describe('verifyUser', () => {
    it('should set isVerified=true and clear OTP fields', async () => {
      mockUserModel.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

      await service.verifyUser('test@example.com');

      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { isVerified: true, otpCode: null, otpExpires: null },
      );
    });
  });

  // ─── updatePassword ────────────────────────────────────────────────────────

  describe('updatePassword', () => {
    it('should hash the new password and update it', async () => {
      const spy = jest.spyOn(service, 'hashPassword').mockResolvedValue('newHash');
      mockUserModel.updateOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });

      await service.updatePassword('test@example.com', 'newPlainPass');

      expect(spy).toHaveBeenCalledWith('newPlainPass');
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { $set: { password: 'newHash' } },
      );
    });
  });

  // ─── updateOtp ─────────────────────────────────────────────────────────────

  describe('updateOtp', () => {
    it('should update OTP fields for existing user', async () => {
      mockUserModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      });

      const expires = new Date();
      await service.updateOtp('test@example.com', '654321', expires);

      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { $set: { otpCode: '654321', otpExpires: expires } },
      );
    });

    it('should throw an error when user is not found', async () => {
      mockUserModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
      });

      await expect(
        service.updateOtp('no@user.com', '000000', new Date()),
      ).rejects.toThrow('User not found');
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return an array of users', async () => {
      mockUserModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([mockUserData]) });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
    });
  });
});
