import {
  BadRequestException,
  Controller,
  Get,
  Param,
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
    } = query
    if (!origin || !destination || !departureDate) {
      throw new BadRequestException('Origin, destination, and departure date are required');
    }

    try {
      const rawFlights = await this.flightsService.searchFlights(
        origin,
        destination,
        departureDate,
        adults,
        returnDate,
        50,
      );

      if (!rawFlights || !rawFlights.results) {
        return { items: [], total: 0, page: query.page || 1 };
      }

      return await this.flightsService.processFlightResults(rawFlights, query);

    } catch (error) {
      console.error('Error in search:', error.message);
      throw new BadRequestException(error.message || 'Failed to search flights');
    }
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
