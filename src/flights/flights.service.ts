import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { FlightSearch } from './schemas/flight.schema';
import { Model } from 'mongoose';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { AirlinesService } from 'src/airlines/airlines.service';
interface MappedSegment {
    departure: any;
    arrival: any;
    carrierCode: string;
    flightNumber: string;
    aircraft: any;
    duration: string;
    layover?: string;
}
@Injectable()
export class FlightsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(FlightSearch.name)
    private flightSearchModel: Model<FlightSearch>,
    private airlineService: AirlinesService,
  ) {}

  private async getAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) return this.accessToken;

    const url = 'https://test.api.amadeus.com/v1/security/oauth2/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.AMADEUS_CLIENT_ID ?? '');
    params.append('client_secret', process.env.AMADEUS_CLIENT_SECRET ?? '');

    const response = await firstValueFrom(
      this.httpService.post(url, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = now + response.data.expires_in * 1000;
    return this.accessToken;
  }

  async searchFlights(
    origin: string,
    destination: string,
    departureDate: string,
    adults: number,
    returnDate?: string,
    maxToFetch: number = 50,
  ) {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    if (departureDate < today) {
      throw new BadRequestException('Cannot search for flights in the past');
    }
    if (returnDate && returnDate < departureDate){
      throw new BadRequestException('Return date must be after departure date');
    }

    try {
      const cachedSearch = await this.flightSearchModel
        .findOne({
          origin,
          destination,
          departureDate,
          returnDate,
          adults,
        })
        .lean();

      if (cachedSearch && cachedSearch.results) {
        return cachedSearch;
      }
    } catch (error: any) {
      console.error('Error from read database:', error.message);
    }

    const token = await this.getAccessToken();
    const url = 'https://test.api.amadeus.com/v2/shopping/flight-offers';

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate: departureDate,
            returnDate: returnDate,
            adults: adults,
            currencyCode: 'CAD',
            max: maxToFetch, // was 5
          },
        }),
      );

      const flights = response.data.data;

      const newFlight = await this.flightSearchModel.create({
        origin,
        destination,
        departureDate,
        returnDate,
        adults,
        results: flights,
      });

      return newFlight.toObject();
    } catch (error: any) {
      console.error(
        'Amadeus API Error:',
        error.response?.data || error.message,
      );

      if (error.response?.status === 400) {
        throw new BadRequestException('Invalid flight search parameters');
      }

      throw new Error('Could not fetch flights from Amadeus');
    }
  }

  async processFlightResults(rawSearch: any, query: SearchFlightsDto)
  {
    const {
      page = 1,
      limit = 5,
      maxPrice,
      stops,
      airline,
      cabin,
      timeFrom,
    } = query;

    let results = rawSearch.results || [];

    // --- 1. APPLY FILTERS ---
    const filteredFlights = results.filter((flight) => {
      if (!flight?.itineraries?.[0]?.segments?.length) return false;

      // Max price
      if (maxPrice && parseFloat(flight.price.total) > maxPrice) return false;

      // Stops
      if (stops !== undefined) {
        const flightStops = flight.itineraries[0].segments.length - 1;
        if (flightStops !== stops) return false;
      }

      // Airline
      if (airline && !flight.validatingAirlineCodes.includes(airline.toUpperCase())) return false;

      // Cabin
      if (cabin) {
        const hasMatchingCabin = flight.travelerPricings?.some(
          (tp: any) =>
            tp.fareDetailsBySegment?.[0]?.cabin?.toUpperCase() === cabin.toUpperCase(),
        );
        if (!hasMatchingCabin) return false;
      }

      // Time range
      if (timeFrom) {
        const departureAt = flight.itineraries[0].segments[0].departure?.at;
        const timeString = departureAt?.split('T')[1]?.substring(0, 5);
        if (!timeString || timeString < timeFrom) return false;
      }

      return true;
    });
      // --- 2. PAGINATION ---
    const total = filteredFlights.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageItems = filteredFlights.slice(start, end);

    // --- 3. MAPPING & FORMATTING ---
    const items = await Promise.all(
      pageItems.map(async (flight) => {
        const airlineCode = flight.validatingAirlineCodes[0];
        const airlineInfo = await this.airlineService.getAirlineByIata(airlineCode);

        return {
          id: flight.id,
          search_id: rawSearch._id,
          airline: {
            name: airlineInfo?.name || airlineCode,
            logo: airlineInfo?.logo || '',
          },
          price: {
            amount: parseFloat(flight.price.total),
            currency: flight.price.currency,
          },
          itineraries: flight.itineraries.map((it, index) => ({
            type: index === 0 ? 'outbound' : 'inbound',
            duration: this.formatDuration(it.duration),
            stops: it.segments.length - 1,
            departure: this.formatEndPoint(it.segments[0].departure),
            arrival: this.formatEndPoint(it.segments[it.segments.length - 1].arrival),
            segments: it.segments.map((s, sIdx) => {
              const segmentData: any = this.mapSegment(s); 
              
              if (sIdx < it.segments.length - 1) {
                segmentData.layover = this.calculateLayover(
                  s.arrival.at, 
                  it.segments[sIdx + 1].departure.at
                );
              }
              return segmentData;
            }),
          })),
          cabin: flight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.cabin,
          baggage: {
            checked: flight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.includedCheckedBags?.quantity || 0
          }
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
  }

  private formatDuration(d: string) {
    return d.replace('PT', '').replace('H', 'h ').replace('M', 'm').toLowerCase();
  }

  private formatEndPoint(ep: any) {
    return {
      time: ep.at.split('T')[1].substring(0, 5),
      date: ep.at.split('T')[0],
      iataCode: ep.iataCode,
      terminal: ep.terminal,
    };
  }

  private mapSegment(s: any) {
    return {
      departure: s.departure,
      arrival: s.arrival,
      carrierCode: s.carrierCode,
      flightNumber: s.number,
      aircraft: s.aircraft.code,
      duration: s.duration,
    };
  }
  private calculateLayover(arrivalAt: string, nextDepartureAt: string): string {
    const arrival = new Date(arrivalAt);
    const departure = new Date(nextDepartureAt);

    const diffMs = departure.getTime() - arrival.getTime();

    if (diffMs <= 0) return '';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;

    return result.trim();
  }
  async getFlightDetail(searchId: string, flightId: string) {
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();

    if (!flightSearch) {
      throw new NotFoundException('Flights are not available, please try again later!!!');
    }

    // 1. Tìm flight thô từ kết quả search
    const rawFlight = flightSearch.results.find((f: any) => f.id === flightId);

    if (!rawFlight) {
      throw new NotFoundException('Flight can not be found!');
    }

    // 2. Thực hiện Mapping giống hệt như lúc process results
    const airlineCode = rawFlight.validatingAirlineCodes[0];
    const airlineInfo = await this.airlineService.getAirlineByIata(airlineCode);

    // Trả về đúng interface FlightResult mà Frontend mong đợi
    return {
      id: rawFlight.id,
      search_id: flightSearch._id, // Quan trọng: lấy ID của bản ghi search
      airline: {
        name: airlineInfo?.name || airlineCode,
        logo: airlineInfo?.logo || '',
      },
      price: {
        amount: parseFloat(rawFlight.price.total),
        currency: rawFlight.price.currency,
      },
      itineraries: rawFlight.itineraries.map((it, index) => ({
        type: index === 0 ? 'outbound' : 'inbound',
        duration: this.formatDuration(it.duration),
        stops: it.segments.length - 1,
        departure: this.formatEndPoint(it.segments[0].departure),
        arrival: this.formatEndPoint(it.segments[it.segments.length - 1].arrival),
        segments: it.segments.map((s, sIdx) => {
          // Sử dụng các hàm helper có sẵn của bạn
          const segmentData: any = {
            departure: this.formatEndPoint(s.departure), // Format lại endpoint cho segment
            arrival: this.formatEndPoint(s.arrival),     // Format lại endpoint cho segment
            carrierCode: s.carrierCode,
            flightNumber: s.number,
            aircraft: s.aircraft.code,
            duration: this.formatDuration(s.duration),
          };

          if (sIdx < it.segments.length - 1) {
            segmentData.layover = this.calculateLayover(
              s.arrival.at,
              it.segments[sIdx + 1].departure.at,
            );
          }
          return segmentData;
        }),
      })),
      cabin: rawFlight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.cabin,
      baggage: {
        checked: rawFlight.travelerPricings?.[0]?.fareDetailsBySegment[0]?.includedCheckedBags?.quantity || 0,
      },
    };
  }
}
