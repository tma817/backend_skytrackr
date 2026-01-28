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
    try {
      const {
        origin = '',
        destination = '',
        date = '',
        adults = 1,
        page = 1,
        limit = 5,
        maxPrice,
        stops,
        airline,
        cabin,
        timeFrom,
        timeTo,
      } = query;

      const rawFlights = await this.flightsService.searchFlights(
        origin,
        destination,
        date,
        adults,
        50,
      );

      if (!rawFlights || !rawFlights.results) {
        return {
          items: [],
          page,
          limit,
          total: 0,
          hasMore: false,
        };
      }

      const all = rawFlights.results;
      // APPLY FILTERS
      const filteredFlights = all.filter((flight) => {
        if (!flight?.itineraries?.[0]?.segments?.length) return false;
        // Max price
        if (maxPrice && parseFloat(flight.price.total) > maxPrice) return false;

        // Stops
        if (stops !== undefined) {
          const flightStops = flight.itineraries[0].segments.length - 1;
          if (flightStops !== stops) return false;
        }

        // Airline
        if (airline && !flight.validatingAirlineCodes.includes(airline))
          return false;

        // Cabin
        if (cabin) {
          const hasMatchingCabin = flight.travelerPricings?.some(
            (tp: any) =>
              tp.fareDetailsBySegment?.[0]?.cabin?.toUpperCase() ===
              cabin.toUpperCase(),
          );
          if (!hasMatchingCabin) return false;
        }

        // Time range
        if (timeFrom || timeTo) {
          const departureAt = flight.itineraries[0].segments[0].departure?.at;
          if (!departureAt) return false;
          const timeString = departureAt.split('T')[1]?.substring(0, 5); // Get HH:mm
          if (!timeString) return false;

          if (timeFrom && timeString < timeFrom) return false;
          if (timeTo && timeString > timeTo) return false;
        }

        return true;
      });

      const total = filteredFlights.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageItems = filteredFlights.slice(start, end);

      const items = await Promise.all(
        pageItems.map(async (flight) => {
          const itinerary = flight.itineraries[0];
          const segments = itinerary.segments;
          const firstSegment = segments[0];
          const lastSegment = segments[segments.length - 1];
          const airlineCode = flight.validatingAirlineCodes[0];
          const airlineInfo =
            await this.airlinesService.getAirlineByIata(airlineCode);

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

            stops:
              segments.length > 1 ? `${segments.length - 1} stop` : 'Direct',
          };
        }),
      );

      return {
        items,
        page,
        limit,
        total,
        hasMore: end < total,
      };
    } catch (error) {
      console.error('Error in FlightsController search method:', error);
      throw new BadRequestException('Failed to search flights');
    }
  }

  @Get(':id')
  async getOne(
    @Param('id') flightId: string,
    @Query('searchId') searchId: string,
  ) {
    try {
      if (!searchId) {
        throw new BadRequestException(
          'searchId is required to retrieve flight details',
        );
      }
      const rawFlight = await this.flightsService.getFlightDetail(
        searchId,
        flightId,
      );

      if (!rawFlight) {
        throw new BadRequestException('Flight not found');
      }

      const airlineInfo = await this.airlinesService.getAirlineByIata(
        rawFlight.validatingAirlineCodes?.[0],
      );

      return {
        ...rawFlight,
        airlineName:
          airlineInfo?.name ||
          rawFlight.validatingAirlineCodes?.[0] ||
          'Unknown',
        airlineLogo: airlineInfo?.logo || '',
      };
    } catch (error) {
      // ADD THIS ENTIRE BLOCK
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error in FlightsController getOne method:', error);
      throw new BadRequestException('Failed to retrieve flight details');
    }
  }
}
