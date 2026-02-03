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
import { GeminiService } from 'src/gemini/gemini.service';

@Injectable()
export class FlightsService {
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(FlightSearch.name)
    private flightSearchModel: Model<FlightSearch>,
    private readonly geminiService: GeminiService, // INJECT GeminiService
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
    const today = new Date().toISOString().split('T')[0];

    if (date < today) {
      throw new BadRequestException('Cannot search for flights in the past');
    }

    try {
      // Check cache first
      const cachedSearch = await this.flightSearchModel.findOne({
        origin,
        destination,
        departureDate: date,
        adults,
      });

      if (cachedSearch && cachedSearch.results) {
        // If AI predictions haven't been processed yet, process them in background
        if (!cachedSearch.aiProcessed) {
          this.processAIPredictionsInBackground(cachedSearch._id.toString());
        }
        return cachedSearch.toObject();
      }
    } catch (error: any) {
      console.error('Error from read database:', error.message);
    }

    // Not in cache, fetch from Amadeus
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
            max: maxToFetch,
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
        aiPredictions: [],
        aiProcessed: false,
      });

      // Process AI predictions in background (don't block the response)
      this.processAIPredictionsInBackground(newFlight._id.toString());

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

  /**
   * Process AI predictions in background without blocking
   */
  private async processAIPredictionsInBackground(searchId: string) {
    try {
      const flightSearch = await this.flightSearchModel.findById(searchId);
      if (!flightSearch || flightSearch.aiProcessed) return;

      const flights = flightSearch.results;
      if (!flights || flights.length === 0) return;

      // Prepare data for AI (limit to first 20 flights to control costs)
      const flightsToPredict = flights.slice(0, 20).map((flight) => {
        const segments = flight.itineraries?.[0]?.segments || [];
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];

        return {
          route: `${firstSegment?.departure?.iataCode}-${lastSegment?.arrival?.iataCode}`,
          currentPrice: parseFloat(flight.price?.total || '0'),
          departureDate: firstSegment?.departure?.at?.split('T')[0] || '',
          historicalPrices: [], // TODO: Add historical tracking
        };
      });

      // Get AI recommendations in batch
      console.log(`Processing AI predictions for ${flightsToPredict.length} flights...`);
      const recommendations = await this.geminiService.batchFlightRecommendations(
        flightsToPredict,
      );

      // Build predictions array
      const aiPredictions = flights.slice(0, 20).map((flight, index) => ({
        flightId: flight.id,
        recommendation: recommendations[index]?.recommendation || 'WAIT',
        confidence: recommendations[index]?.confidence || 'LOW',
      }));

      // Update database with AI predictions
      await this.flightSearchModel.findByIdAndUpdate(searchId, {
        aiPredictions,
        aiProcessed: true,
      });

      console.log(`✅ AI predictions cached for search ${searchId}`);
    } catch (error) {
      console.error('Error processing AI predictions in background:', error);
      // Don't throw - this is background processing
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

  /**
   * Get AI prediction for a specific flight from cache
   */
  getAIPredictionForFlight(
    aiPredictions: any[],
    flightId: string,
  ): { recommendation: string; confidence: string } | null {
    if (!aiPredictions || aiPredictions.length === 0) return null;

    const prediction = aiPredictions.find((p) => p.flightId === flightId);
    return prediction || null;
  }
}