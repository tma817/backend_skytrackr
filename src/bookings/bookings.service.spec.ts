import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { getModelToken } from '@nestjs/mongoose';
import { Booking } from './schemas/booking.schema';
import { FlightSearch } from 'src/flights/schemas/flight.schema';
import { HttpService } from '@nestjs/axios';
import { MailService } from 'src/mail/mail.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockFlightOffer = {
  id: '2',
  validatingAirlineCodes: ['AC'],
  price: { total: '850.00', currency: 'CAD' },
  itineraries: [
    {
      segments: [
        {
          departure: { iataCode: 'YUL', at: '2026-05-15T08:00:00', terminal: '1' },
          arrival: { iataCode: 'LHR', at: '2026-05-15T20:00:00', terminal: '5' },
          carrierCode: 'AC',
          number: '870',
          aircraft: { code: '788' },
          duration: 'PT7H0M',
        },
      ],
      duration: 'PT7H0M',
    },
  ],
};

const mockFlightSearch = {
  _id: 'search-id-123',
  origin: 'YUL',
  destination: 'LHR',
  departureDate: '2026-05-15',
  adults: 1,
  results: [mockFlightOffer],
};

const mockBooking = {
  _id: 'booking-id-123',
  amadeusOrderId: 'order-1',
  pnr: 'ABC123',
  flightOffer: mockFlightOffer,
  travelers: [
    {
      id: '1',
      name: { firstName: 'JOHN', lastName: 'DOE' },
      dateOfBirth: '1990-01-01',
    },
  ],
  seatings: [],
  totalPrice: '850.00',
  currency: 'CAD',
  status: 'CONFIRMED',
  createdAt: new Date(),
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFlightSearchModel = {
  findById: jest.fn(),
};

const mockBookingModel = {
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
};

const mockHttpService = {
  post: jest.fn(),
  get: jest.fn(),
};

const mockMailService = {
  sendBookingConfirmation: jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Booking.name), useValue: mockBookingModel },
        { provide: getModelToken(FlightSearch.name), useValue: mockFlightSearchModel },
        { provide: HttpService, useValue: mockHttpService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    // Bypass Amadeus token fetch for all tests
    jest.spyOn(service as any, 'getAccessToken').mockResolvedValue('mock-token');
  });

  // ─── createBooking ──────────────────────────────────────────────────────────

  describe('createBooking', () => {
    const dto = {
      searchId: 'search-id-123',
      flightId: '2',
      travelers: [mockBooking.travelers[0]],
      seatings: [],
      remarks: undefined,
      ticketingAgreement: undefined,
    };

    it('should throw NotFoundException when flight search session is not found', async () => {
      mockFlightSearchModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.createBooking(dto as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flight offer is not in the search results', async () => {
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ ...mockFlightSearch, results: [] }),
      });

      await expect(service.createBooking(dto as any)).rejects.toThrow(NotFoundException);
    });

    it('should create a booking and return confirmation', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      // Re-search returns matching offer
      mockHttpService.get.mockReturnValueOnce(of({ data: { data: [mockFlightOffer] } }));

      // mockHttpService.post: first call = pricing, second call = booking order
      mockHttpService.post
        .mockReturnValueOnce(of({ data: { data: { flightOffers: [mockFlightOffer] } } }))
        .mockReturnValueOnce(
          of({
            data: {
              data: {
                id: 'order-1',
                associatedRecords: [{ reference: 'ABC123' }],
                travelers: mockBooking.travelers,
                flightOffers: [mockFlightOffer],
              },
            },
          }),
        );

      mockBookingModel.create.mockResolvedValue(mockBooking);
      mockMailService.sendBookingConfirmation.mockResolvedValue(undefined);

      const result = await service.createBooking(dto as any);

      expect(result.pnr).toBe('ABC123');
      expect(result.status).toBe('CONFIRMED');
      expect(mockBookingModel.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when Amadeus booking API fails', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('network')));
      mockHttpService.post.mockReturnValueOnce(throwError(() => ({
        response: { data: { errors: [{ detail: 'SEGMENT SOLD OUT' }] } },
      })));

      await expect(service.createBooking(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── trackBooking ──────────────────────────────────────────────────────────

  describe('trackBooking', () => {
    it('should throw NotFoundException when PNR is not found', async () => {
      mockBookingModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.trackBooking('XXXXXX', 'DOE')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when last name does not match any traveler', async () => {
      mockBookingModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooking),
      });

      await expect(service.trackBooking('ABC123', 'SMITH')).rejects.toThrow(NotFoundException);
    });

    it('should return booking data from Amadeus when available', async () => {
      mockBookingModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooking),
      });

      mockHttpService.get.mockReturnValueOnce(
        of({
          data: {
            data: {
              flightOffers: [mockFlightOffer],
              travelers: mockBooking.travelers,
            },
          },
        }),
      );

      const result = await service.trackBooking('ABC123', 'DOE');

      expect(result.pnr).toBe('ABC123');
      expect(result.source).toBe('amadeus');
      expect(result.travelers[0].name).toContain('JOHN');
    });

    it('should fall back to local data when Amadeus returns an error', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockBookingModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooking),
      });

      mockHttpService.get.mockReturnValueOnce(
        throwError(() => ({
          response: { data: { errors: [{ detail: 'Order not found' }] } },
          message: 'Request failed with status code 404',
        })),
      );

      const result = await service.trackBooking('ABC123', 'DOE');

      expect(result.pnr).toBe('ABC123');
      expect(result.source).toBe('local');
      expect(result.itineraries).toBeDefined();
    });

    it('should return price from local flightOffer when Amadeus is unavailable', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockBookingModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooking),
      });

      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('Network error')));

      const result = await service.trackBooking('ABC123', 'DOE');

      expect(result.price.amount).toBe('850.00');
      expect(result.price.currency).toBe('CAD');
    });
  });

  // ─── getBookingsByUser ─────────────────────────────────────────────────────

  describe('getBookingsByUser', () => {
    it('should return bookings for a user sorted by date', async () => {
      mockBookingModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockBooking]),
          }),
        }),
      });

      const result = await service.getBookingsByUser('user-id-123');

      expect(result).toHaveLength(1);
      expect(result[0].pnr).toBe('ABC123');
    });
  });

  // ─── getBookingById ────────────────────────────────────────────────────────

  describe('getBookingById', () => {
    it('should return a booking by ID', async () => {
      mockBookingModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockBooking),
      });

      const result = await service.getBookingById('booking-id-123');

      expect(result.pnr).toBe('ABC123');
    });

    it('should throw NotFoundException when booking is not found', async () => {
      mockBookingModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getBookingById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
