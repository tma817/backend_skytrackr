import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.gaurd';

const mockBookingsService = {
  createBooking: jest.fn(),
  getBookingsByUser: jest.fn(),
  trackBooking: jest.fn(),
  getBookingById: jest.fn(),
};

const mockBooking = {
  _id: 'booking-id-123',
  pnr: 'ABC123',
  status: 'CONFIRMED',
  totalPrice: '850.00',
  currency: 'CAD',
};

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: mockBookingsService }],
    })
      // Skip JWT guard so we can test controller logic directly
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should call bookingsService.createBooking and return the result', async () => {
      const dto = { searchId: 'sid', flightId: '1', travelers: [] };
      mockBookingsService.createBooking.mockResolvedValue(mockBooking);

      const result = await controller.create(dto as any);

      expect(mockBookingsService.createBooking).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockBooking);
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return bookings for the authenticated user', async () => {
      const req = { user: { userId: 'user-123' } };
      mockBookingsService.getBookingsByUser.mockResolvedValue([mockBooking]);

      const result = await controller.findAll(req as any);

      expect(mockBookingsService.getBookingsByUser).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(1);
    });
  });

  // ─── track ─────────────────────────────────────────────────────────────────

  describe('track', () => {
    it('should call trackBooking with PNR and last name', async () => {
      const trackResult = { pnr: 'ABC123', source: 'amadeus' };
      mockBookingsService.trackBooking.mockResolvedValue(trackResult);

      const result = await controller.track('ABC123', 'DOE');

      expect(mockBookingsService.trackBooking).toHaveBeenCalledWith('ABC123', 'DOE');
      expect(result).toEqual(trackResult);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a booking by ID', async () => {
      mockBookingsService.getBookingById.mockResolvedValue(mockBooking);

      const result = await controller.findOne('booking-id-123');

      expect(mockBookingsService.getBookingById).toHaveBeenCalledWith('booking-id-123');
      expect(result).toEqual(mockBooking);
    });
  });
});
