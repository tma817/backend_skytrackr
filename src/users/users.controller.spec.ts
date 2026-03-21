import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateUser: jest.fn(),
};

const rawUser = {
  _id: 'user-id',
  fname: 'John',
  lname: 'Doe',
  email: 'test@example.com',
  password: 'hashed',
  otpCode: '123456',
  otpExpires: new Date(),
  isVerified: true,
  toObject: jest.fn().mockReturnValue({
    _id: 'user-id',
    fname: 'John',
    lname: 'Doe',
    email: 'test@example.com',
    password: 'hashed',
    otpCode: '123456',
    otpExpires: new Date(),
    isVerified: true,
  }),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── getAllUsers ────────────────────────────────────────────────────────────

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      mockUsersService.findAll.mockResolvedValue([rawUser]);

      const result = await controller.getAllUsers();

      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  // ─── getUserByEmail ────────────────────────────────────────────────────────

  describe('getUserByEmail', () => {
    it('should return user without sensitive fields', async () => {
      mockUsersService.findOne.mockResolvedValue(rawUser);

      const result = await controller.getUserByEmail('test@example.com');

      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('otpCode');
      expect(result).not.toHaveProperty('otpExpires');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(controller.getUserByEmail('no@user.com')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('should update user and return safe fields', async () => {
      const updatedUser = {
        ...rawUser,
        fname: 'Jane',
        toObject: jest.fn().mockReturnValue({
          _id: 'user-id',
          fname: 'Jane',
          lname: 'Doe',
          email: 'test@example.com',
          password: 'hashed',
          otpCode: null,
          otpExpires: null,
          isVerified: true,
        }),
      };
      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser('test@example.com', { fname: 'Jane' } as any);

      expect(mockUsersService.updateUser).toHaveBeenCalledWith(
        'test@example.com',
        expect.not.objectContaining({ otpCode: expect.anything() }),
      );
      expect(result).not.toHaveProperty('password');
      expect(result.fname).toBe('Jane');
    });

    it('should strip sensitive fields from update payload before calling service', async () => {
      mockUsersService.updateUser.mockResolvedValue({
        ...rawUser,
        toObject: jest.fn().mockReturnValue({ _id: 'user-id', email: 'test@example.com' }),
      });

      await controller.updateUser('test@example.com', {
        fname: 'Jane',
        otpCode: 'hack',
        isVerified: true,
      } as any);

      const callArg = mockUsersService.updateUser.mock.calls[0][1];
      expect(callArg).not.toHaveProperty('otpCode');
      expect(callArg).not.toHaveProperty('isVerified');
      expect(callArg).not.toHaveProperty('otpExpires');
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      mockUsersService.updateUser.mockResolvedValue(null);

      await expect(
        controller.updateUser('no@user.com', { fname: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
