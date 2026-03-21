import { Test, TestingModule } from '@nestjs/testing';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.gaurd';

const mockWatchlistService = {
  create: jest.fn(),
  findAllByUser: jest.fn(),
  remove: jest.fn(),
};

const mockReq = { user: { userId: 'user-123', email: 'test@example.com' } };

const mockItem = {
  _id: 'item-id',
  origin: 'YUL',
  destination: 'LHR',
  initialPrice: 800,
  status: 'active',
};

describe('WatchlistController', () => {
  let controller: WatchlistController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchlistController],
      providers: [{ provide: WatchlistService, useValue: mockWatchlistService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WatchlistController>(WatchlistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should call watchlistService.create with userId, email, and dto', async () => {
      const dto = { flightId: 'f1', origin: 'YUL', destination: 'LHR', initialPrice: 800 };
      mockWatchlistService.create.mockResolvedValue(mockItem);

      const result = await controller.create(mockReq as any, dto as any);

      expect(mockWatchlistService.create).toHaveBeenCalledWith('user-123', 'test@example.com', dto);
      expect(result).toEqual(mockItem);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all watchlist items for the authenticated user', async () => {
      mockWatchlistService.findAllByUser.mockResolvedValue([mockItem]);

      const result = await controller.findAll(mockReq as any);

      expect(mockWatchlistService.findAllByUser).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(1);
      expect(result[0].origin).toBe('YUL');
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should call watchlistService.remove with userId and item id', async () => {
      mockWatchlistService.remove.mockResolvedValue({ message: 'Removed from watchlist' });

      const result = await controller.remove(mockReq as any, 'item-id');

      expect(mockWatchlistService.remove).toHaveBeenCalledWith('user-123', 'item-id');
      expect(result.message).toBe('Removed from watchlist');
    });
  });
});
