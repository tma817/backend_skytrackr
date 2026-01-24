import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class FlightsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(private readonly httpService: HttpService) {}

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
  ) {
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
            max: 5,
          },
        }),
      );
      return response.data.data;
    } catch (error) {
      console.error(
        'Amadeus API Error:',
        error.response?.data || error.message,
      );
      throw new Error('Could not fetch flights from Amadeus');
    }
  }
}
