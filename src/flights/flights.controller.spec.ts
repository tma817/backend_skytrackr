import { Test, TestingModule } from '@nestjs/testing';
import FlightsController from './flights.controller';
import { FlightsService } from './flights.service';
import { AirlinesService } from 'src/airlines/airlines.service';
import { BadRequestException } from '@nestjs/common';

const mockFlightsService = {
  searchFlights: jest.fn(),
  processFlightResults: jest.fn(),
  confirmPrice: jest.fn(),
  getPriceGrid: jest.fn(),
  getSeatMap: jest.fn(),
  getFlightDetail: jest.fn(),
};

const mockAirlinesService = {
  getAirlineByIata: jest.fn(),
};

const mockSearchResult = {
  items: [{ id: '1', airline: { name: 'Air Canada' } }],
  page: 1,
  limit: 5,
  total: 1,
  hasMore: false,
};

describe('FlightsController', () => {
  let controller: FlightsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlightsController],
      providers: [
        { provide: FlightsService, useValue: mockFlightsService },
        { provide: AirlinesService, useValue: mockAirlinesService },
      ],
    }).compile();

    controller = module.get<FlightsController>(FlightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    const baseQuery = {
      origin: 'YUL',
      destination: 'LHR',
      departureDate: '2026-06-15',
      adults: 1,
    };

    it('should throw BadRequestException when origin is missing', async () => {
      await expect(
        controller.search({ ...baseQuery, origin: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when destination is missing', async () => {
      await expect(
        controller.search({ ...baseQuery, destination: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when departureDate is missing', async () => {
      await expect(
        controller.search({ ...baseQuery, departureDate: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return flight results for valid query', async () => {
      const rawFlights = { _id: 'sid', results: [{}] };
      mockFlightsService.searchFlights.mockResolvedValue(rawFlights);
      mockFlightsService.processFlightResults.mockResolvedValue(mockSearchResult);

      const result = await controller.search(baseQuery as any);

      expect(mockFlightsService.searchFlights).toHaveBeenCalledWith(expect.objectContaining({
        origin: 'YUL',
        destination: 'LHR',
        departureDate: '2026-06-15',
      }));
      expect(mockFlightsService.processFlightResults).toHaveBeenCalledWith(rawFlights, baseQuery);
      expect(result).toEqual(mockSearchResult);
    });

    it('should return empty items when searchFlights returns no results', async () => {
      mockFlightsService.searchFlights.mockResolvedValue({ results: null });

      const result = await controller.search(baseQuery as any);

      expect(result).toEqual({ items: [], total: 0, page: 1 });
      expect(mockFlightsService.processFlightResults).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when service throws an error', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFlightsService.searchFlights.mockRejectedValue(new Error('Amadeus down'));

      await expect(controller.search(baseQuery as any)).rejects.toThrow(BadRequestException);
    });

    it('should pass optional filters to searchFlights', async () => {
      const rawFlights = { _id: 'sid', results: [{}] };
      mockFlightsService.searchFlights.mockResolvedValue(rawFlights);
      mockFlightsService.processFlightResults.mockResolvedValue(mockSearchResult);

      await controller.search({
        ...baseQuery,
        nonStop: true,
        travelClass: 'BUSINESS',
        maxPrice: 2000,
      } as any);

      expect(mockFlightsService.searchFlights).toHaveBeenCalledWith(
        expect.objectContaining({ nonStop: true, travelClass: 'BUSINESS', maxPrice: 2000 }),
      );
    });
  });

  // ─── confirmPrice ──────────────────────────────────────────────────────────

  describe('confirmPrice', () => {
    it('should throw BadRequestException when searchId is missing', async () => {
      await expect(controller.confirmPrice('', 'flight-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when flightId is missing', async () => {
      await expect(controller.confirmPrice('search-1', '')).rejects.toThrow(BadRequestException);
    });

    it('should call service and return confirmed price', async () => {
      const priceResult = { confirmed: true, price: { grandTotal: 900 } };
      mockFlightsService.confirmPrice.mockResolvedValue(priceResult);

      const result = await controller.confirmPrice('search-1', 'flight-1');

      expect(mockFlightsService.confirmPrice).toHaveBeenCalledWith('search-1', 'flight-1');
      expect(result).toEqual(priceResult);
    });
  });

  // ─── getPriceGrid ──────────────────────────────────────────────────────────

  describe('getPriceGrid', () => {
    it('should throw BadRequestException when origin is missing', async () => {
      await expect(
        controller.getPriceGrid('', 'LHR', '2026-06-15'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when destination is missing', async () => {
      await expect(
        controller.getPriceGrid('YUL', '', '2026-06-15'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when departureDate is missing', async () => {
      await expect(
        controller.getPriceGrid('YUL', 'LHR', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return price grid data', async () => {
      const gridData = { data: [{ date: '2026-06-15', price: 800 }], cached: true };
      mockFlightsService.getPriceGrid.mockResolvedValue(gridData);

      const result = await controller.getPriceGrid('YUL', 'LHR', '2026-06-15', 'CAD', 'true');

      expect(mockFlightsService.getPriceGrid).toHaveBeenCalledWith({
        origin: 'YUL',
        destination: 'LHR',
        departureDate: '2026-06-15',
        currency: 'CAD',
        oneWay: true,
      });
      expect(result).toEqual(gridData);
    });

    it('should parse oneWay=false correctly', async () => {
      mockFlightsService.getPriceGrid.mockResolvedValue({});

      await controller.getPriceGrid('YUL', 'LHR', '2026-06-15', 'CAD', 'false');

      expect(mockFlightsService.getPriceGrid).toHaveBeenCalledWith(
        expect.objectContaining({ oneWay: false }),
      );
    });
  });

  // ─── getSeatMap ────────────────────────────────────────────────────────────

  describe('getSeatMap', () => {
    it('should delegate to flightsService.getSeatMap', async () => {
      const seatData = [{ deck: 'MAIN' }];
      mockFlightsService.getSeatMap.mockResolvedValue(seatData);

      const result = await controller.getSeatMap('search-1', 'flight-1');

      expect(mockFlightsService.getSeatMap).toHaveBeenCalledWith('search-1', 'flight-1');
      expect(result).toEqual(seatData);
    });
  });

  // ─── getOne ────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('should throw BadRequestException when searchId is missing', async () => {
      await expect(controller.getOne('flight-1', '')).rejects.toThrow(BadRequestException);
    });

    it('should return flight detail', async () => {
      const detail = { id: 'flight-1', airline: { name: 'Air Canada' } };
      mockFlightsService.getFlightDetail.mockResolvedValue(detail);

      const result = await controller.getOne('flight-1', 'search-1');

      expect(mockFlightsService.getFlightDetail).toHaveBeenCalledWith('search-1', 'flight-1');
      expect(result).toEqual(detail);
    });
  });
});
