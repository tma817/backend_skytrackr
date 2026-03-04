import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { FlightsService } from './flights.service';
import { AirlinesService } from 'src/airlines/airlines.service';
import { SearchFlightsDto } from './dto/search-flights.dto';

@Controller('flights')
export default class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly airlinesService: AirlinesService,
  ) {}

  @Get('search')
  async search(@Query() query: SearchFlightsDto) {
    const {
      origin = '',
      destination = '',
      departureDate = '',
      adults = 1,
      returnDate,
      children,
      currencyCode,
      travelClass,
      max,
      nonStop,
      includedAirlineCodes,
      excludedAirlineCodes,
      maxPrice,
      includedCheckedBagsOnly,
      excludedAlliances,
    } = query;
    if (!origin || !destination || !departureDate) {
      throw new BadRequestException('Origin, destination, and departure date are required');
    }

    try {
      const rawFlights = await this.flightsService.searchFlights({
        origin,
        destination,
        departureDate,
        adults,
        returnDate,
        children,
        currencyCode,
        travelClass,
        max,
        nonStop,
        includedAirlineCodes,
        excludedAirlineCodes,
        maxPrice,
        includedCheckedBagsOnly,
        excludedAlliances,
      });

      if (!rawFlights || !rawFlights.results) {
        return { items: [], total: 0, page: query.page || 1 };
      }

      return await this.flightsService.processFlightResults(rawFlights, query);

    } catch (error) {
      console.error('Error in search:', error.message);
      throw new BadRequestException(error.message || 'Failed to search flights');
    }
  }

  @Post('confirm-price')
  async confirmPrice(
    @Query('searchId') searchId: string,
    @Query('flightId') flightId: string,
  ) {
    if (!searchId || !flightId) {
      throw new BadRequestException('searchId and flightId are required');
    }
    return await this.flightsService.confirmPrice(searchId, flightId);
  }

  /**
   * GET /flights/price-grid
   * ?origin=YYZ&destination=LAX&departureDate=2025-06-01&currency=CAD&oneWay=true
   *
   * Returns cheapest price per day for the given month.
   * Single Amadeus API call; cached 6 h in MongoDB.
   */
  @Get('price-grid')
  async getPriceGrid(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('departureDate') departureDate: string,
    @Query('currency') currency?: string,
    @Query('oneWay') oneWay?: string,
  ) {
    if (!origin || !destination || !departureDate) {
      throw new BadRequestException('origin, destination, and departureDate are required');
    }
    return this.flightsService.getPriceGrid({
      origin,
      destination,
      departureDate,
      currency,
      oneWay: oneWay !== 'false',
    });
  }

  @Get('seat-map')
  async getSeatMap(
    @Query('searchId') searchId: string,
    @Query('flightId') flightId: string,
  ) {
    return await this.flightsService.getSeatMap(searchId, flightId);
  }

  @Get(':id')
  async getOne(
    @Param('id') flightId: string,
    @Query('searchId') searchId: string,
  ) {
    if (!searchId) {
      throw new BadRequestException('searchId is required');
    }
    return await this.flightsService.getFlightDetail(searchId, flightId);
  }
  
}
