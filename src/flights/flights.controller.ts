import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { FlightsService } from './flights.service';
import { AirlinesService } from 'src/airlines/airlines.service';

@Controller('flights')
export default class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly airlinesService: AirlinesService,
  ) {}

  @Get('search')
  async search(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('date') date: string,
    @Query('adults') adults: string,
    @Query('page') page: string,
    @Query('limit') limit: string, 
  ) {
    const adultsNum = parseInt(adults) || 1;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 5, 1), 50); // limit 1~50

    const rawFlights = await this.flightsService.searchFlights(
      origin,
      destination,
      date,
      adultsNum,
      50, 
    );

    const all = rawFlights.results || [];
    const total = all.length;

    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;
    const pageItems = all.slice(start, end);

    const items = await Promise.all(
      pageItems.map(async (flight) => {
        const itinerary = flight.itineraries[0];
        const segments = itinerary.segments;
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        const airlineCode = flight.validatingAirlineCodes[0];
        const airlineInfo = await this.airlinesService.getAirlineByIata(
          airlineCode,
        );

        return {
          id: flight.id,
          search_id: rawFlights._id,
          airlineName: airlineInfo?.name || airlineCode,
          airlineLogo: airlineInfo?.logo || '',

          departure: {
            time: firstSegment.departure.at.split('T')[1].substring(0, 5),
            date: firstSegment.departure.at.split('T')[0],
            iataCode: firstSegment.departure.iataCode,
            terminal: firstSegment.departure.terminal,
          },
          arrival: {
            time: lastSegment.arrival.at.split('T')[1].substring(0, 5),
            date: lastSegment.arrival.at.split('T')[0],
            iataCode: lastSegment.arrival.iataCode,
            terminal: lastSegment.arrival.terminal,
          },

          duration: itinerary.duration
            .replace('PT', '')
            .replace('H', 'h ')
            .replace('M', 'm')
            .toLowerCase(),

          price: parseFloat(flight.price.total),
          currency: flight.price.currency,

          originCode: segments[0].departure.iataCode,
          destinationCode: segments[segments.length - 1].arrival.iataCode,

          segments: segments.map((s) => ({
            departure: s.departure,
            arrival: s.arrival,
            carrierCode: s.carrierCode,
            flightNumber: s.number,
            aircraft: s.aircraft.code,
            duration: s.duration,
          })),

          travelerPricings: flight.travelerPricings.map((tp) => ({
            fareOption: tp.fareOption,
            travelerType: tp.travelerType,
            cabin: tp.fareDetailsBySegment[0].cabin,
            amenities: tp.fareDetailsBySegment[0].amenities,
          })),

          stops: segments.length > 1 ? `${segments.length - 1} stop` : 'Direct',
        };
      }),
    );

    return {
      items,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: end < total,
    };
  }

  @Get(':id')
  async getOne(@Param('id') flightId: string, @Query('searchId') searchId: string) {
    if (!searchId) {
      throw new BadRequestException(
        'searchId is required to retrieve flight details',
      );
    }
    const rawFlight = await this.flightsService.getFlightDetail(searchId, flightId);

    const airlineInfo = await this.airlinesService.getAirlineByIata(
      rawFlight.validatingAirlineCodes[0],
    );

    return {
      ...rawFlight,
      airlineName: airlineInfo?.name || rawFlight.validatingAirlineCodes[0],
      airlineLogo: airlineInfo?.logo || '',
    };
  }
}
