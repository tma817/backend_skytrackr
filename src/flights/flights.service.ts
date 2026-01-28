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

@Injectable()
export class FlightsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(FlightSearch.name)
    private flightSearchModel: Model<FlightSearch>,
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
    date: string,
    adults: number,
    maxToFetch: number = 50,
  ) {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    if (date < today) {
      throw new BadRequestException('Cannot search for flights in the past');
    }

    try {
      const cachedSearch = await this.flightSearchModel
        .findOne({
          origin,
          destination,
          departureDate: date,
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
            departureDate: date,
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
        departureDate: date,
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

  async getFlightDetail(searchId: string, flightId: string) {
    const flightSearch = await this.flightSearchModel.findById(searchId).lean();

    if (!flightSearch) {
      throw new NotFoundException(
        'Flights are not available, please try again later!!!',
      );
    }

    const flight = flightSearch.results.find((f: any) => f.id === flightId);

    if (!flight) {
      throw new NotFoundException('Flight can not be found!');
    }

    return flight;
  }
}
