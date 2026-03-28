import { Test, TestingModule } from '@nestjs/testing';
import { WatchlistService } from './watchlist.service';
import { getModelToken } from '@nestjs/mongoose';
import { Watchlist } from './schemas/watchlist.schema';
import { PriceHistory } from './schemas/price-history.schema';
import { HttpService } from '@nestjs/axios';
import { AirlinesService } from 'src/airlines/airlines.service';
import { MailService } from 'src/mail/mail.service';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { of, throwError } from 'rxjs';

const userId = new Types.ObjectId().toString();
const watchlistId = new Types.ObjectId().toString();

const mockWatchlistItem = {
  _id: watchlistId,
  userId: new Types.ObjectId(userId),
  userEmail: 'test@example.com',
  flightId: 'flight-1',
  origin: 'YUL',
  destination: 'LHR',
  departureDate: '2026-05-15',
  initialPrice: 800,
  currentPrice: 800,
  status: 'active',
  passengers: 1,
  tripType: 'ONE_WAY',
  airlineName: 'Air Canada',
  airlineLogo: 'https://logo.url/ac.png',
  currency: 'CAD',
  createdAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
};

const mockWatchlistModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
};

function MockWatchlistConstructor(data: any) {
  return {
    ...data,
    save: jest.fn().mockResolvedValue({ ...data, _id: watchlistId }),
  };
}
Object.assign(MockWatchlistConstructor, mockWatchlistModel);

const mockPriceHistoryModel = {
  create: jest.fn(),
};

const mockHttpService = { post: jest.fn(), get: jest.fn() };

describe('WatchlistService', () => {
  let service: WatchlistService;
  let airlinesService: jest.Mocked<AirlinesService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistService,
        { provide: getModelToken(Watchlist.name), useValue: MockWatchlistConstructor },
        { provide: getModelToken(PriceHistory.name), useValue: mockPriceHistoryModel },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: AirlinesService,
          useValue: { getAirlineByIata: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendPriceDropAlert: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WatchlistService>(WatchlistService);
    airlinesService = module.get(AirlinesService);
    mailService = module.get(MailService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      flightId: 'flight-1',
      origin: 'YUL',
      destination: 'LHR',
      departureDate: '2026-05-15',
      initialPrice: 800,
      passengers: 1,
      tripType: 'ONE_WAY',
      airlineName: 'Air Canada',
      airlineLogo: 'https://logo.url/ac.png',
      currency: 'CAD',
    };

    it('should create a new watchlist item when it does not exist', async () => {
      mockWatchlistModel.findOne.mockResolvedValue(null);

      await service.create(userId, 'test@example.com', dto as any);

      // constructor was called (new item created)
      expect(mockWatchlistModel.findOne).toHaveBeenCalled();
    });

    it('should update existing item if duplicate is found', async () => {
      const existing = {
        ...mockWatchlistItem,
        save: jest.fn().mockResolvedValue(mockWatchlistItem),
      };
      mockWatchlistModel.findOne.mockResolvedValue(existing);

      await service.create(userId, 'test@example.com', { ...dto, passengers: 2 } as any);

      expect(existing.passengers).toBe(2);
      expect(existing.save).toHaveBeenCalled();
    });
  });

  // ─── findAllByUser ─────────────────────────────────────────────────────────

  describe('findAllByUser', () => {
    it('should return transformed watchlist items for a user', async () => {
      mockWatchlistModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockWatchlistItem]),
        }),
      });

      const result = await service.findAllByUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].origin).toBe('YUL');
      expect(result[0].destination).toBe('LHR');
      expect(result[0].priceDiff).toBe(0);
      expect(result[0].currency).toBe('CAD');
    });

    it('should return an empty array when user has no watchlist items', async () => {
      mockWatchlistModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.findAllByUser(userId);

      expect(result).toHaveLength(0);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete watchlist item and return success message', async () => {
      mockWatchlistModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await service.remove(userId, watchlistId);

      expect(result.message).toBe('Removed from watchlist');
    });

    it('should throw NotFoundException when item is not found', async () => {
      mockWatchlistModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.remove(userId, watchlistId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── transformFlightData ───────────────────────────────────────────────────

  describe('transformFlightData', () => {
    const mockFlight = {
      id: 'f1',
      validatingAirlineCodes: ['AC'],
      price: { total: '850.00', currency: 'CAD' },
      itineraries: [
        {
          duration: 'PT7H30M',
          segments: [
            {
              departure: { iataCode: 'YUL', at: '2026-05-15T08:00:00', terminal: '1' },
              arrival: { iataCode: 'LHR', at: '2026-05-15T20:30:00', terminal: '5' },
            },
          ],
        },
      ],
    };

    it('should transform flight data correctly', async () => {
      airlinesService.getAirlineByIata.mockResolvedValue({
        name: 'Air Canada',
        logo: 'https://logo.url/ac.png',
        country: 'Canada',
      });

      const result = await service.transformFlightData(mockFlight, 'search-123');

      expect(result.id).toBe('f1');
      expect(result.search_id).toBe('search-123');
      expect(result.airlineName).toBe('Air Canada');
      expect(result.departure.iataCode).toBe('YUL');
      expect(result.arrival.iataCode).toBe('LHR');
      expect(result.price).toBe(850);
      expect(result.stops).toBe('Direct');
      expect(result.duration).toBe('7h 30m');
    });

    it('should use IATA code as fallback when airline name is unknown', async () => {
      airlinesService.getAirlineByIata.mockResolvedValue(null);

      const result = await service.transformFlightData(mockFlight, 'search-123');

      expect(result.airlineName).toBe('AC');
      expect(result.airlineLogo).toBe('');
    });

    it('should correctly indicate 1 stop for a connecting flight', async () => {
      airlinesService.getAirlineByIata.mockResolvedValue(null);

      const twoSegmentFlight = {
        ...mockFlight,
        itineraries: [
          {
            duration: 'PT12H0M',
            segments: [
              {
                departure: { iataCode: 'YUL', at: '2026-05-15T08:00:00', terminal: '1' },
                arrival: { iataCode: 'YYZ', at: '2026-05-15T09:30:00', terminal: '' },
              },
              {
                departure: { iataCode: 'YYZ', at: '2026-05-15T11:00:00', terminal: '' },
                arrival: { iataCode: 'LHR', at: '2026-05-15T22:00:00', terminal: '5' },
              },
            ],
          },
        ],
      };

      const result = await service.transformFlightData(twoSegmentFlight, 'search-456');

      expect(result.stops).toBe('1 stop');
    });
  });

  // ─── getAccessToken ────────────────────────────────────────────────────────

  describe('getAccessToken', () => {
    it('should fetch a new token when none is cached', async () => {
      mockHttpService.post.mockReturnValue(
        of({ data: { access_token: 'fresh-token', expires_in: 1799 } }),
      );

      const token = await (service as any).getAccessToken();

      expect(token).toBe('fresh-token');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/token'),
        expect.any(String),
        expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
      );
    });

    it('should return the cached token when it has not expired', async () => {
      // Populate the cache
      (service as any).accessToken = 'cached-token';
      (service as any).tokenExpiry = Date.now() + 60_000;

      const token = await (service as any).getAccessToken();

      expect(token).toBe('cached-token');
      expect(mockHttpService.post).not.toHaveBeenCalled();
    });

    it('should fetch a new token when the cached one has expired', async () => {
      (service as any).accessToken = 'old-token';
      (service as any).tokenExpiry = Date.now() - 1000; // expired

      mockHttpService.post.mockReturnValue(
        of({ data: { access_token: 'renewed-token', expires_in: 1799 } }),
      );

      const token = await (service as any).getAccessToken();

      expect(token).toBe('renewed-token');
    });
  });

  // ─── checkPrices (cron) ────────────────────────────────────────────────────

  describe('checkPrices', () => {
    const activeItem = {
      ...mockWatchlistItem,
      _id: watchlistId,
      initialPrice: 800,
      currentPrice: 800,
      status: 'active',
      departureDate: '2099-12-31', // future date so it stays active
    };

    beforeEach(() => {
      // Pre-load a valid cached token so getAccessToken doesn't call HTTP
      (service as any).accessToken = 'cached-token';
      (service as any).tokenExpiry = Date.now() + 60_000;
    });

    it('should update status to price_dropped and send email when price falls', async () => {
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([activeItem]),
      });
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [{ price: { total: '650.00' } }] } }),
      );
      mockPriceHistoryModel.create.mockResolvedValue({});
      mockWatchlistModel.updateOne.mockResolvedValue({});
      mailService.sendPriceDropAlert.mockResolvedValue(undefined);

      await service.checkPrices();

      expect(mockWatchlistModel.updateOne).toHaveBeenCalledWith(
        { _id: watchlistId },
        { $set: expect.objectContaining({ status: 'price_dropped', currentPrice: 650 }) },
      );
      expect(mailService.sendPriceDropAlert).toHaveBeenCalledWith(
        expect.objectContaining({ currentPrice: 650, initialPrice: 800 }),
      );
    });

    it('should update status to price_increased when price rises above current', async () => {
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([activeItem]),
      });
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [{ price: { total: '950.00' } }] } }),
      );
      mockPriceHistoryModel.create.mockResolvedValue({});
      mockWatchlistModel.updateOne.mockResolvedValue({});

      await service.checkPrices();

      expect(mockWatchlistModel.updateOne).toHaveBeenCalledWith(
        { _id: watchlistId },
        { $set: expect.objectContaining({ status: 'price_increased' }) },
      );
      expect(mailService.sendPriceDropAlert).not.toHaveBeenCalled();
    });

    it('should keep status active when price is unchanged', async () => {
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([activeItem]),
      });
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [{ price: { total: '800.00' } }] } }),
      );
      mockPriceHistoryModel.create.mockResolvedValue({});
      mockWatchlistModel.updateOne.mockResolvedValue({});

      await service.checkPrices();

      expect(mockWatchlistModel.updateOne).toHaveBeenCalledWith(
        { _id: watchlistId },
        { $set: expect.objectContaining({ status: 'active' }) },
      );
    });

    it('should skip item when Amadeus returns no flights', async () => {
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([activeItem]),
      });
      mockHttpService.get.mockReturnValue(of({ data: { data: [] } }));

      await service.checkPrices();

      expect(mockWatchlistModel.updateOne).not.toHaveBeenCalled();
      expect(mockPriceHistoryModel.create).not.toHaveBeenCalled();
    });

    it('should skip item when price fetch throws an error', async () => {
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([activeItem]),
      });
      mockHttpService.get.mockReturnValue(throwError(() => new Error('network')));

      await service.checkPrices();

      expect(mockWatchlistModel.updateOne).not.toHaveBeenCalled();
    });

    it('should do nothing when there are no active watchlist items', async () => {
      mockWatchlistModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      await service.checkPrices();

      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(mockWatchlistModel.updateOne).not.toHaveBeenCalled();
    });
  });
});
