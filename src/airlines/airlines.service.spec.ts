import { Test, TestingModule } from '@nestjs/testing';
import { AirlinesService } from './airlines.service';
import { getModelToken } from '@nestjs/mongoose';
import { Airline } from './schemas/airline.schema';
import { AirlinePolicy } from './schemas/airline-policy.schema';
import { AIRLINE_POLICIES_SEED } from './data/airline-policies.seed';

const mockPolicy = {
  _id: 'policy-id',
  iata: 'AC',
  name: 'Air Canada',
  country: 'Canada',
  hub: 'YYZ',
  alliance: 'Star Alliance',
  logo: 'https://logo.url/ac.png',
};

const mockAirlineModel = {
  countDocuments: jest.fn(),
  findOne: jest.fn(),
  insertMany: jest.fn(),
};

const mockPolicyModel = {
  countDocuments: jest.fn(),
  insertMany: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

describe('AirlinesService', () => {
  let service: AirlinesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirlinesService,
        { provide: getModelToken('Airline'), useValue: mockAirlineModel },
        { provide: getModelToken('AirlinePolicy'), useValue: mockPolicyModel },
      ],
    }).compile();

    service = module.get<AirlinesService>(AirlinesService);
    // Clear the internal cache between tests
    (service as any).airlineCache = new Map();
  });

  // ─── seedPoliciesIfEmpty ───────────────────────────────────────────────────

  describe('seedPoliciesIfEmpty', () => {
    it('should skip seeding when policies already exist', async () => {
      mockPolicyModel.countDocuments.mockResolvedValue(5);

      await service.seedPoliciesIfEmpty();

      expect(mockPolicyModel.insertMany).not.toHaveBeenCalled();
    });

    it('should seed policies when collection is empty', async () => {
      mockPolicyModel.countDocuments.mockResolvedValue(0);
      mockPolicyModel.insertMany.mockResolvedValue([]);

      await service.seedPoliciesIfEmpty();

      expect(mockPolicyModel.insertMany).toHaveBeenCalledWith(AIRLINE_POLICIES_SEED);
    });
  });

  // ─── getAllPolicies ────────────────────────────────────────────────────────

  describe('getAllPolicies', () => {
    it('should return all policies with no filters', async () => {
      mockPolicyModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockPolicy]) });

      const result = await service.getAllPolicies();

      expect(mockPolicyModel.find).toHaveBeenCalledWith({});
      expect(result).toHaveLength(1);
    });

    it('should filter by alliance', async () => {
      mockPolicyModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockPolicy]) });

      await service.getAllPolicies(undefined, 'Star Alliance');

      expect(mockPolicyModel.find).toHaveBeenCalledWith({ alliance: 'Star Alliance' });
    });

    it('should filter by search term (name/iata/country)', async () => {
      mockPolicyModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([mockPolicy]) });

      await service.getAllPolicies('canada');

      const call = mockPolicyModel.find.mock.calls[0][0];
      expect(call.$or).toBeDefined();
      expect(call.$or).toHaveLength(3);
    });

    it('should not apply alliance filter when alliance is "All"', async () => {
      mockPolicyModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      await service.getAllPolicies(undefined, 'All');

      const call = mockPolicyModel.find.mock.calls[0][0];
      expect(call.alliance).toBeUndefined();
    });

    it('should combine search and alliance filters', async () => {
      mockPolicyModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      await service.getAllPolicies('canada', 'Star Alliance');

      const call = mockPolicyModel.find.mock.calls[0][0];
      expect(call.alliance).toBe('Star Alliance');
      expect(call.$or).toBeDefined();
    });
  });

  // ─── getPolicyByIata ──────────────────────────────────────────────────────

  describe('getPolicyByIata', () => {
    it('should return policy for a valid IATA code', async () => {
      mockPolicyModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockPolicy) });

      const result = await service.getPolicyByIata('ac');

      // Should uppercase the IATA code
      expect(mockPolicyModel.findOne).toHaveBeenCalledWith({ iata: 'AC' });
      expect(result).toEqual(mockPolicy);
    });

    it('should return null for unknown IATA code', async () => {
      mockPolicyModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const result = await service.getPolicyByIata('XX');

      expect(result).toBeNull();
    });
  });

  // ─── getAirlineByIata ─────────────────────────────────────────────────────

  describe('getAirlineByIata', () => {
    it('should return null for empty IATA code', async () => {
      const result = await service.getAirlineByIata('');
      expect(result).toBeNull();
    });

    it('should return airline info from DB and cache it', async () => {
      mockAirlineModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            name: 'Air Canada',
            logo: 'https://logo.url/ac.png',
            country: 'Canada',
          }),
        }),
      });

      const result = await service.getAirlineByIata('AC');

      expect(result).toEqual({ name: 'Air Canada', logo: 'https://logo.url/ac.png', country: 'Canada' });

      // Second call should use cache, not DB
      const resultCached = await service.getAirlineByIata('AC');
      expect(mockAirlineModel.findOne).toHaveBeenCalledTimes(1);
      expect(resultCached).toEqual(result);
    });

    it('should return fallback logo when airline is not in DB', async () => {
      mockAirlineModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.getAirlineByIata('ZZ');

      expect(result.name).toBe('ZZ');
      expect(result.logo).toContain('ZZ');
    });

    it('should return fallback when DB throws an error', async () => {
      mockAirlineModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const result = await service.getAirlineByIata('EK');

      expect(result).toEqual({ name: 'EK', logo: '' });
    });
  });
});
