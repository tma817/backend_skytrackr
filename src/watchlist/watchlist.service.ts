import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Watchlist } from './schemas/watchlist.schema';
import { PriceHistory } from './schemas/price-history.schema';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { AirlinesService } from 'src/airlines/airlines.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);
  private accessToken: string = '';
  private tokenExpiry: number = 0;

  constructor(
    @InjectModel(Watchlist.name) private watchlistModel: Model<Watchlist>,
    @InjectModel(PriceHistory.name) private priceHistoryModel: Model<PriceHistory>,
    private readonly httpService: HttpService,
    private readonly airlinesService: AirlinesService,
    private readonly mailService: MailService,
  ) {}

  // ─── Amadeus Auth ────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
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

  // ─── Fetch lowest price for a route from Amadeus ─────────────────────────────

  private async fetchLowestPrice(
    origin: string,
    destination: string,
    departureDate: string,
    adults: number,
  ): Promise<number | null> {
    try {
      const token = await this.getAccessToken();
      const response = await firstValueFrom(
        this.httpService.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate,
            adults,
            currencyCode: 'CAD',
            max: 10,
          },
        }),
      );

      const offers: any[] = response.data.data ?? [];
      if (!offers.length) return null;

      const prices = offers.map((o: any) => parseFloat(o.price.total));
      return Math.min(...prices);
    } catch (error: any) {
      this.logger.warn(`Failed to fetch price for ${origin}→${destination}: ${error.message}`);
      return null;
    }
  }

  // ─── Cron: every 6 hours ─────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_6_HOURS)
  async checkPrices(): Promise<void> {
    this.logger.log('Running watchlist price check...');

    const today = new Date().toISOString().split('T')[0];
    const activeItems = await this.watchlistModel
      .find({ status: { $in: ['active', 'price_increased'] }, departureDate: { $gte: today } })
      .lean();

    this.logger.log(`Checking ${activeItems.length} active watchlist items`);

    for (const item of activeItems) {
      const newPrice = await this.fetchLowestPrice(
        item.origin,
        item.destination,
        item.departureDate,
        item.passengers,
      );

      if (newPrice === null) continue;

      // Persist price snapshot for AI prediction history
      const departure = new Date(item.departureDate);
      const today2 = new Date();
      const daysUntilFlight = Math.ceil(
        (departure.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24),
      );
      await this.priceHistoryModel.create({
        origin: item.origin,
        destination: item.destination,
        departureDate: item.departureDate,
        price: newPrice,
        currency: item.currency ?? 'CAD',
        daysUntilFlight,
        recordedAt: new Date(),
      });

      const update: any = { currentPrice: newPrice };

      if (newPrice < item.initialPrice) {
        update.status = 'price_dropped';
        await this.mailService.sendPriceDropAlert({
          email: item.userEmail,
          origin: item.origin,
          destination: item.destination,
          departureDate: item.departureDate,
          initialPrice: item.initialPrice,
          currentPrice: newPrice,
          currency: 'CAD',
          watchlistId: String(item._id),
        });
      } else if (newPrice > item.currentPrice) {
        update.status = 'price_increased';
      } else {
        update.status = 'active';
      }

      await this.watchlistModel.updateOne({ _id: item._id }, { $set: update });
    }

    this.logger.log('Watchlist price check complete');
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async create(userId: string, userEmail: string, dto: CreateWatchlistDto): Promise<Watchlist> {
    const existing = await this.watchlistModel.findOne({
      userId: new Types.ObjectId(userId),
      flightId: dto.flightId,
      origin: dto.origin,
      destination: dto.destination,
      departureDate: dto.departureDate,
    });

    if (existing) {
      existing.passengers = dto.passengers;
      existing.tripType = dto.tripType;
      return existing.save();
    }

    const newItem = new this.watchlistModel({
      ...dto,
      userId: new Types.ObjectId(userId),
      userEmail,
      currentPrice: dto.initialPrice,
    });

    return newItem.save();
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const watchlistItems = await this.watchlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    // No FlightSearch model needed here — return watchlist data directly
    return watchlistItems.map((item) => ({
      _id: item._id,
      flightId: item.flightId,
      searchId: item.searchId,
      returnDate: item.returnDate ?? null,
      savedAt: (item as any).createdAt,
      origin: item.origin,
      destination: item.destination,
      departureDate: item.departureDate,
      departureTime: item.departureTime ?? null,
      returnTime: item.returnTime ?? null,
      initialPrice: item.initialPrice,
      currentPrice: item.currentPrice,
      priceDiff: +(item.currentPrice - item.initialPrice).toFixed(2),
      status: item.status,
      passengers: item.passengers,
      tripType: item.tripType,
      airlineName: item.airlineName,
      airlineLogo: item.airlineLogo,
      currency: item.currency ?? 'CAD',
    }));
  }

  async remove(userId: string, id: string): Promise<any> {
    const result = await this.watchlistModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Watchlist item not found');
    }
    return { message: 'Removed from watchlist' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  async transformFlightData(flight: any, searchId: string) {
    const itinerary = flight.itineraries[0];
    const segments = itinerary.segments;
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const airlineCode = flight.validatingAirlineCodes[0];

    const airlineInfo = await this.airlinesService.getAirlineByIata(airlineCode);

    return {
      id: flight.id,
      search_id: searchId,
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
      duration: itinerary.duration.replace('PT', '').replace('H', 'h ').replace('M', 'm').toLowerCase(),
      price: parseFloat(flight.price.total),
      currency: flight.price.currency,
      stops: segments.length > 1 ? `${segments.length - 1} stop` : 'Direct',
    };
  }
}
