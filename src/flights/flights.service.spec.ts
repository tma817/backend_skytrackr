import { Test, TestingModule } from '@nestjs/testing';
import { FlightsService } from './flights.service';
import { getModelToken } from '@nestjs/mongoose';
import { FlightSearch } from './schemas/flight.schema';
import { PriceGrid } from './schemas/price-grid.schema';
import { HttpService } from '@nestjs/axios';
import { AirlinesService } from 'src/airlines/airlines.service';
import { AirportsService } from 'src/airports/airports.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const makeSegment = (
  depIata: string,
  depAt: string,
  arrIata: string,
  arrAt: string,
  carrier = 'AC',
  num = '870',
) => ({
  departure: { iataCode: depIata, at: depAt, terminal: '1' },
  arrival: { iataCode: arrIata, at: arrAt, terminal: '2' },
  carrierCode: carrier,
  number: num,
  aircraft: { code: '788' },
  duration: 'PT7H0M',
});

const directSegment = makeSegment('YUL', '2026-06-15T08:00:00', 'LHR', '2026-06-15T20:00:00');
const connectingSegment1 = makeSegment('YUL', '2026-06-15T08:00:00', 'YYZ', '2026-06-15T09:30:00');
const connectingSegment2 = makeSegment('YYZ', '2026-06-15T11:30:00', 'LHR', '2026-06-15T22:00:00');

const makeFlight = (id: string, price: string, segments = [directSegment], cabin = 'ECONOMY') => ({
  id,
  validatingAirlineCodes: ['AC'],
  price: { total: price, currency: 'CAD', grandTotal: price, base: '700.00' },
  itineraries: [{ duration: 'PT7H0M', segments }],
  travelerPricings: [
    {
      travelerId: '1',
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { total: price, base: '700.00', currency: 'CAD' },
      fareDetailsBySegment: [
        { cabin, fareBasis: 'YOW', includedCheckedBags: { quantity: 1 } },
      ],
    },
  ],
  numberOfBookableSeats: 9,
  lastTicketingDate: '2026-06-10',
  pricingOptions: { refundableFare: false },
});

const mockSearchId = 'search-id-123';
const mockFlightSearch = {
  _id: mockSearchId,
  origin: 'YUL',
  destination: 'LHR',
  departureDate: '2026-06-15',
  adults: 1,
  results: [makeFlight('1', '850.00'), makeFlight('2', '1200.00')],
};

// ─── Model mocks ──────────────────────────────────────────────────────────────

const mockFlightSearchModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockPriceGridModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

const mockHttpService = { get: jest.fn(), post: jest.fn() };
const mockAirlinesService = { getAirlineByIata: jest.fn() };
const mockAirportsService = { getByIata: jest.fn().mockResolvedValue(null) };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('FlightsService', () => {
  let service: FlightsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: getModelToken(FlightSearch.name), useValue: mockFlightSearchModel },
        { provide: getModelToken(PriceGrid.name), useValue: mockPriceGridModel },
        { provide: HttpService, useValue: mockHttpService },
        { provide: AirlinesService, useValue: mockAirlinesService },
        { provide: AirportsService, useValue: mockAirportsService },
      ],
    }).compile();

    service = module.get<FlightsService>(FlightsService);
    jest.spyOn(service as any, 'getAccessToken').mockResolvedValue('mock-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── searchFlights ──────────────────────────────────────────────────────────

  describe('searchFlights', () => {
    const baseParams = {
      origin: 'YUL',
      destination: 'LHR',
      departureDate: '2026-06-15',
      adults: 1,
    };

    it('should throw BadRequestException for a past departure date', async () => {
      await expect(
        service.searchFlights({ ...baseParams, departureDate: '2025-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when return date is before departure date', async () => {
      await expect(
        service.searchFlights({ ...baseParams, returnDate: '2026-06-10' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return cached results when available and no extra params', async () => {
      const toObjectResult = { ...mockFlightSearch };
      mockFlightSearchModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      const result = await service.searchFlights(baseParams);

      expect(mockFlightSearchModel.findOne).toHaveBeenCalled();
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockFlightSearch);
    });

    it('should fetch from Amadeus when no cache exists', async () => {
      mockFlightSearchModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const createdDoc = {
        ...mockFlightSearch,
        toObject: jest.fn().mockReturnValue(mockFlightSearch),
      };
      mockFlightSearchModel.create.mockResolvedValue(createdDoc);
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [makeFlight('1', '850.00')] } }),
      );

      const result = await service.searchFlights(baseParams);

      expect(mockHttpService.get).toHaveBeenCalled();
      expect(mockFlightSearchModel.create).toHaveBeenCalled();
      expect(result).toEqual(mockFlightSearch);
    });

    it('should bypass cache when extra params are provided', async () => {
      const createdDoc = {
        ...mockFlightSearch,
        toObject: jest.fn().mockReturnValue(mockFlightSearch),
      };
      mockFlightSearchModel.create.mockResolvedValue(createdDoc);
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [makeFlight('1', '850.00')] } }),
      );

      await service.searchFlights({ ...baseParams, nonStop: true });

      expect(mockFlightSearchModel.findOne).not.toHaveBeenCalled();
      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it('should throw BadRequestException on Amadeus 400 response', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightSearchModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 400, data: {} }, message: 'Bad Request' })),
      );

      await expect(service.searchFlights(baseParams)).rejects.toThrow(BadRequestException);
    });

    it('should throw generic Error on non-400 Amadeus failure', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightSearchModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      mockHttpService.get.mockReturnValue(
        throwError(() => ({ response: { status: 500, data: {} }, message: 'Server Error' })),
      );

      await expect(service.searchFlights(baseParams)).rejects.toThrow('Could not fetch flights from Amadeus');
    });
  });

  // ─── processFlightResults ──────────────────────────────────────────────────

  describe('processFlightResults', () => {
    beforeEach(() => {
      mockAirlinesService.getAirlineByIata.mockResolvedValue({
        name: 'Air Canada',
        logo: 'https://logo.url/ac.png',
      });
    });

    const rawSearch = {
      _id: mockSearchId,
      results: [
        makeFlight('1', '850.00'),
        makeFlight('2', '1200.00'),
        makeFlight('3', '500.00'),
        makeFlight('4', '750.00', [connectingSegment1, connectingSegment2]),
      ],
    };

    it('should return paginated results with correct structure', async () => {
      const result = await service.processFlightResults(rawSearch, { page: 1, limit: 2 } as any);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should return the second page correctly', async () => {
      const result = await service.processFlightResults(rawSearch, { page: 2, limit: 2 } as any);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by maxPrice', async () => {
      const result = await service.processFlightResults(rawSearch, { maxPrice: 900 } as any);

      expect(result.items.every((f) => f.price.amount <= 900)).toBe(true);
    });

    it('should filter direct flights by stops=0', async () => {
      const result = await service.processFlightResults(rawSearch, { stops: 0 } as any);

      expect(result.items.every((f) => f.itineraries[0].stops === 0)).toBe(true);
    });

    it('should filter connecting flights by stops=1', async () => {
      const result = await service.processFlightResults(rawSearch, { stops: 1 } as any);

      expect(result.total).toBe(1);
      expect(result.items[0].itineraries[0].stops).toBe(1);
    });

    it('should filter by airline code', async () => {
      const mixedSearch = {
        _id: mockSearchId,
        results: [
          makeFlight('1', '850.00'),
          { ...makeFlight('2', '900.00'), validatingAirlineCodes: ['EK'] },
        ],
      };
      const result = await service.processFlightResults(mixedSearch, { airline: 'AC' } as any);

      expect(result.total).toBe(1);
      expect(result.items[0].airline.name).toBe('Air Canada');
    });

    it('should filter by cabin class', async () => {
      const businessFlight = makeFlight('5', '3000.00', [directSegment], 'BUSINESS');
      const mixedSearch = { _id: mockSearchId, results: [makeFlight('1', '850.00'), businessFlight] };

      const result = await service.processFlightResults(mixedSearch, { cabin: 'BUSINESS' } as any);

      expect(result.total).toBe(1);
      expect(result.items[0].cabin).toBe('BUSINESS');
    });

    it('should filter by departure time range', async () => {
      const result = await service.processFlightResults(rawSearch, {
        timeFrom: '07:00',
        timeTo: '09:00',
      } as any);

      // directSegment departs at 08:00 — should match
      expect(result.total).toBeGreaterThan(0);
      expect(result.items.every((f) => {
        const time = f.itineraries[0].departure.time;
        return time >= '07:00' && time <= '09:00';
      })).toBe(true);
    });

    it('should map airline name and logo correctly', async () => {
      const result = await service.processFlightResults(rawSearch, { page: 1, limit: 1 } as any);

      expect(result.items[0].airline.name).toBe('Air Canada');
      expect(result.items[0].airline.logo).toBe('https://logo.url/ac.png');
    });

    it('should include checked baggage count in result', async () => {
      const result = await service.processFlightResults(rawSearch, { page: 1, limit: 1 } as any);

      expect(result.items[0].baggage.checked).toBe(1);
    });

    it('should return empty items when no results match the filter', async () => {
      const result = await service.processFlightResults(rawSearch, { maxPrice: 100 } as any);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ─── confirmPrice ──────────────────────────────────────────────────────────

  describe('confirmPrice', () => {
    it('should throw NotFoundException when search session is not found', async () => {
      mockFlightSearchModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.confirmPrice('bad-id', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flight is not in the search results', async () => {
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      await expect(service.confirmPrice(mockSearchId, '999')).rejects.toThrow(NotFoundException);
    });

    it('should return confirmed price with grandTotal and breakdown', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      // Re-fetch fails → use cached
      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('network')));

      const confirmedOffer = {
        id: '1',
        price: {
          grandTotal: '900.00',
          base: '750.00',
          currency: 'CAD',
          taxes: [{ code: 'CA', amount: '100.00' }],
          fees: [{ type: 'SUPPLIER', amount: '50.00' }],
        },
        itineraries: [
          {
            duration: 'PT7H0M',
            segments: [
              {
                departure: { iataCode: 'YUL', at: '2026-06-15T08:00:00', terminal: '1' },
                arrival: { iataCode: 'LHR', at: '2026-06-15T20:00:00', terminal: '2' },
                carrierCode: 'AC',
                number: '870',
                aircraft: { code: '788' },
                duration: 'PT7H0M',
              },
            ],
          },
        ],
        travelerPricings: [
          {
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: 'ADULT',
            price: { total: '900.00', base: '750.00', currency: 'CAD' },
            fareDetailsBySegment: [
              { cabin: 'ECONOMY', fareBasis: 'YOW', includedCheckedBags: { quantity: 1 } },
            ],
          },
        ],
      };

      mockHttpService.post.mockReturnValueOnce(
        of({ data: { data: { flightOffers: [confirmedOffer] } } }),
      );

      const result = await service.confirmPrice(mockSearchId, '1');

      expect(result.confirmed).toBe(true);
      expect(result.price.grandTotal).toBe(900);
      expect(result.price.base).toBe(750);
      expect(result.price.taxTotal).toBeCloseTo(150, 1);
      expect(result.price.taxes).toHaveLength(1);
      expect(result.price.currency).toBe('CAD');
    });

    it('should fall back to cached price with confirmed=false when pricing API fails', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('network')));
      mockHttpService.post.mockReturnValueOnce(throwError(() => new Error('pricing failed')));

      const result = await service.confirmPrice(mockSearchId, '1');

      expect(result.confirmed).toBe(false);
      expect(result.price.currency).toBe('CAD');
      expect(result.itineraries).toHaveLength(0);
    });
  });

  // ─── getSeatMap ────────────────────────────────────────────────────────────

  describe('getSeatMap', () => {
    it('should throw NotFoundException when search session is not found', async () => {
      mockFlightSearchModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.getSeatMap('bad-id', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flight is not in results', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      await expect(service.getSeatMap(mockSearchId, '999')).rejects.toThrow(NotFoundException);
    });

    it('should return seat map data on success', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      const seatMapData = [{ deckConfiguration: {}, decks: [] }];
      mockHttpService.post.mockReturnValueOnce(of({ data: { data: seatMapData } }));

      const result = await service.getSeatMap(mockSearchId, '1');

      expect(result).toEqual(seatMapData);
    });

    it('should throw BadRequestException when seat map API fails', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      mockHttpService.post.mockReturnValueOnce(
        throwError(() => ({
          response: { data: { errors: [{ detail: 'No seat map available' }] } },
          message: 'Request failed',
        })),
      );

      await expect(service.getSeatMap(mockSearchId, '1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getFlightDetail ───────────────────────────────────────────────────────

  describe('getFlightDetail', () => {
    it('should throw NotFoundException when search session is not found', async () => {
      mockFlightSearchModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      await expect(service.getFlightDetail('bad-id', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when flight id is not in results', async () => {
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });

      await expect(service.getFlightDetail(mockSearchId, '999')).rejects.toThrow(NotFoundException);
    });

    it('should return formatted flight detail', async () => {
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      mockAirlinesService.getAirlineByIata.mockResolvedValue({
        name: 'Air Canada',
        logo: 'https://logo.url/ac.png',
      });

      const result = await service.getFlightDetail(mockSearchId, '1');

      expect(result.id).toBe('1');
      expect(result.search_id).toBe(mockSearchId);
      expect(result.airline.name).toBe('Air Canada');
      expect(result.price.amount).toBe(850);
      expect(result.price.currency).toBe('CAD');
      expect(result.itineraries[0].type).toBe('outbound');
      expect(result.itineraries[0].stops).toBe(0);
      expect(result.baggage.checked).toBe(1);
    });

    it('should use airline code as fallback name when airline is unknown', async () => {
      mockFlightSearchModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockFlightSearch),
      });
      mockAirlinesService.getAirlineByIata.mockResolvedValue(null);

      const result = await service.getFlightDetail(mockSearchId, '1');

      expect(result.airline.name).toBe('AC');
      expect(result.airline.logo).toBe('');
    });
  });

  // ─── getPriceGrid ──────────────────────────────────────────────────────────

  describe('getPriceGrid', () => {
    const gridParams = {
      origin: 'YUL',
      destination: 'LHR',
      departureDate: '2026-06-15',
      currency: 'CAD',
    };

    it('should return from cache when all 7 window dates are cached', async () => {
      const window = (service as any).buildDateWindow('2026-06-15', 7);
      const cachedData = window.map((d: string) => ({ date: d, price: 800 }));

      mockPriceGridModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ data: cachedData }),
      });

      const result = await service.getPriceGrid(gridParams);

      expect(result.cached).toBe(true);
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(7);
      expect(result.origin).toBe('YUL');
      expect(result.currency).toBe('CAD');
    });

    it('should fetch missing dates from Amadeus and upsert cache', async () => {
      jest.useRealTimers(); // need real timers for setTimeout in the service

      mockPriceGridModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockPriceGridModel.findOneAndUpdate.mockResolvedValue({});
      mockHttpService.get.mockReturnValue(
        of({ data: { data: [{ price: { total: '850.00' } }] } }),
      );

      const result = await service.getPriceGrid(gridParams);

      expect(mockHttpService.get).toHaveBeenCalled();
      expect(mockPriceGridModel.findOneAndUpdate).toHaveBeenCalled();
      expect(result.cached).toBe(false);
      expect(result.data.every((d) => d.price === 850)).toBe(true);
    }, 10000);

    it('should skip dates where Amadeus returns no flights', async () => {
      jest.useRealTimers();

      mockPriceGridModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockPriceGridModel.findOneAndUpdate.mockResolvedValue({});
      // All calls return empty data
      mockHttpService.get.mockReturnValue(of({ data: { data: [] } }));

      const result = await service.getPriceGrid(gridParams);

      expect(result.data).toHaveLength(0);
    }, 10000);
  });

  // ─── private helpers ───────────────────────────────────────────────────────

  describe('formatDuration', () => {
    it('should format PT7H30M to "7h 30m"', () => {
      expect((service as any).formatDuration('PT7H30M')).toBe('7h 30m');
    });

    it('should format PT2H0M to "2h 0m"', () => {
      expect((service as any).formatDuration('PT2H0M')).toBe('2h 0m');
    });
  });

  describe('buildDateWindow', () => {
    it('should return 7 dates centred on the given date', () => {
      const window = (service as any).buildDateWindow('2026-06-15', 7);
      expect(window).toHaveLength(7);
      expect(window[0]).toBe('2026-06-12');
      expect(window[3]).toBe('2026-06-15');
      expect(window[6]).toBe('2026-06-18');
    });
  });

  describe('calculateLayover', () => {
    it('should return correct layover duration', () => {
      const result = (service as any).calculateLayover(
        '2026-06-15T09:30:00',
        '2026-06-15T11:45:00',
      );
      expect(result).toBe('2h 15m');
    });

    it('should return empty string for zero or negative layover', () => {
      const result = (service as any).calculateLayover(
        '2026-06-15T09:30:00',
        '2026-06-15T09:30:00',
      );
      expect(result).toBe('');
    });

    it('should return only hours when minutes are zero', () => {
      const result = (service as any).calculateLayover(
        '2026-06-15T09:00:00',
        '2026-06-15T11:00:00',
      );
      expect(result).toBe('2h');
    });

    it('should return only minutes when hours are zero', () => {
      const result = (service as any).calculateLayover(
        '2026-06-15T09:00:00',
        '2026-06-15T09:45:00',
      );
      expect(result).toBe('45m');
    });
  });

  describe('formatEndPoint', () => {
    it('should extract time, date, iataCode, and terminal', async () => {
      const result = await (service as any).formatEndPoint({
        at: '2026-06-15T08:30:00',
        iataCode: 'YUL',
        terminal: '1',
      });
      expect(result).toEqual({ time: '08:30', date: '2026-06-15', iataCode: 'YUL', terminal: '1', airportName: null, cityName: null });
    });
  });
});
