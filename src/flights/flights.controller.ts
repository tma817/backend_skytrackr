import { Controller, Get, Query } from '@nestjs/common';
import { FlightsService } from './flights.service';

@Controller('flights')
export default class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get('search')
  async search(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('date') date: string,
    @Query('adults') adults: string,
  ) {
    const adultsNum = parseInt(adults) || 1;
    
    const rawFlights = await this.flightsService.searchFlights(
      origin,
      destination,
      date,
      adultsNum,
    );

    return rawFlights.map((flight) => {
    const itinerary = flight.itineraries[0];
    const segments = itinerary.segments; // Danh sách các chặng bay
    
    return {
        id: flight.id,
        airline: flight.validatingAirlineCodes[0],
        time: `${segments[0].departure.at.split('T')[1].substring(0, 5)} - ${segments[segments.length - 1].arrival.at.split('T')[1].substring(0, 5)}`,
        duration: itinerary.duration.replace('PT', '').toLowerCase(),
        price: parseFloat(flight.price.total),
        currency: flight.price.currency,

        segments: segments.map(s => ({
            departure: s.departure,
            arrival: s.arrival,
            carrierCode: s.carrierCode,
            flightNumber: s.number,
            aircraft: s.aircraft.code,
            duration: s.duration
        })),
        
        travelerPricings: flight.travelerPricings.map(tp => ({
            fareOption: tp.fareOption,
            travelerType: tp.travelerType,
            cabin: tp.fareDetailsBySegment[0].cabin, 
            amenities: tp.fareDetailsBySegment[0].amenities 
        })),

        stops: segments.length > 1 ? `${segments.length - 1} stop` : 'Direct',
        };
    });
  }
}